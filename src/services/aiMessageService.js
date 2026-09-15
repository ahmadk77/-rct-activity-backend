const pool = require('../database/connection');

class AIMessageService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.maxTokens = Number.parseInt(process.env.GEMINI_MAX_TOKENS, 10) || 100;
    this.temperature = Number.parseFloat(process.env.GEMINI_TEMPERATURE || '0.7');
    this.aiEnabled = true;
  }

  async generateMessage(culturalProfile, activityData, message_type = 'morning') {
    try {
      // Check if AI messages feature is enabled
      const aiEnabled = await this.isFeatureEnabled('ai_messages');
      if (!aiEnabled) {
        return this.getTemplateMessage(culturalProfile, activityData, message_type);
      }

      // Check if Gemini is configured
      if (!this.apiKey) {
        console.log('Gemini not configured, using fallback messages');
        return this.getTemplateMessage(culturalProfile, activityData, message_type);
      }

      // Generate AI message
      const message = await this.generateAIPersonalizedMessage(
        culturalProfile,
        activityData,
        message_type
      );

      return message;
    } catch (error) {
      console.error('Error generating AI message:', error);
      // Fallback to template-based messages on error
      return this.getTemplateMessage(culturalProfile, activityData, message_type);
    }
  }

  async generateAIPersonalizedMessage(culturalProfile, activityData, message_type) {
    const religiousAffiliation = culturalProfile?.religious_affiliation || 'general';
    const language = culturalProfile?.language || 'ar';
    const familyImportance = culturalProfile?.family_importance_score || 3;
    
    // Calculate activity metrics
    const todaySteps = activityData?.steps || 0;
    const todayMVPA = activityData?.mvpa_minutes || 0;
    const weeklyAvg = todaySteps; // For now, use today's steps as proxy
    
    // Create system prompt for research study context
    const systemPrompt = this.getSystemPrompt(religiousAffiliation, language, familyImportance);
    
    // Create user prompt with specific context
    const userPrompt = this.getUserPrompt(message_type, todaySteps, weeklyAvg, todayMVPA, language);
    
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [{
              role: 'user',
              parts: [{ text: userPrompt }],
            }],
            generationConfig: {
              maxOutputTokens: this.maxTokens,
              temperature: this.temperature,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const message = data.candidates?.[0]?.content?.parts
        ?.map((part) => part.text || '')
        .join('')
        .trim();

      if (!message) {
        throw new Error('Gemini returned no message content');
      }

      return message;
    } catch (error) {
      console.error('Gemini API error:', error);
      // Fallback to template-based messages if AI fails
      return this.getTemplateMessage(culturalProfile, activityData, message_type);
    }
  }

  async isFeatureEnabled(featureName) {
    try {
      const result = await pool.query(
        'SELECT is_enabled FROM feature_flags WHERE feature_name = $1',
        [featureName]
      );
      return result.rows.length > 0 ? result.rows[0].is_enabled : true;
    } catch (error) {
      console.error('Error checking feature flag:', error);
      return true; // Default to enabled
    }
  }

  getSystemPrompt(religiousAffiliation, language, familyImportance) {
    const isArabic = language === 'ar';
    const isIslamic = religiousAffiliation === 'islam';
    
    let toneInstruction = '';
    if (communicationTone === 'direct') {
      toneInstruction = isArabic 
        ? 'استخدم نبرة مباشرة وعملية.' 
        : 'Use a direct and operational tone.';
    } else {
      toneInstruction = isArabic 
        ? 'استخدم نبرة تشجيعية ودافئة تركز على الأسرة.' 
        : 'Use an encouraging, warm tone focusing on family support.';
    }
    
    let culturalInstruction = '';
    if (isIslamic) {
      culturalInstruction = isArabic
        ? 'عند الاقتضاء، استخدم مصطلحات إسلامية مثل "بسم الله"، "جزاك الله خيراً"، "ما شاء الله".'
        : 'When appropriate, use Islamic terms like "Bismillah", "JazakAllah Khair", "MashaAllah".';
    }
    
    let familyInstruction = '';
    if (familyImportance >= 4) {
      familyInstruction = isArabic
        ? 'أكد على أهمية دعم الأسرة والتشجيع العائلي.'
        : 'Emphasize the importance of family support and encouragement.';
    }
    
    if (isArabic) {
      return `أنت مساعد متخصص في دراسة بحثية عن تحفيز النشاط البدني للبالغين الماليزيين.
الهدف: توليد رسائل تحفيزية قصيرة (أقل من 50 كلمة) مخصصة لكل مستخدم.

${toneInstruction}
${culturalInstruction}
${familyInstruction}

القواعد:
- الرسالة يجب أن تكون قصيرة ومباشرة (30-50 كلمة)
- يجب أن تكون ملائمة ثقافياً ودينياً
- تجنب أي محتوى حساس أو غير مناسب
- ركز على التشجيع الإيجابي فقط
- لا تذكر أسماء حقيقية أو معلومات شخصية`;
    } else {
      return `You are a specialized assistant for a research study on physical activity motivation for Malaysian adults.
Goal: Generate short, personalized motivational messages (under 50 words) for each user.

${toneInstruction}
${culturalInstruction}
${familyInstruction}

Rules:
- Keep messages short and direct (30-50 words)
- Must be culturally and religiously appropriate
- Avoid any sensitive or inappropriate content
- Focus only on positive encouragement
- Do not mention real names or personal information`;
    }
  }

  getUserPrompt(message_type, todaySteps, weeklyAvg, todayMVPA, language) {
    const isArabic = language === 'ar';
    
    let timeContext = '';
    if (message_type === 'morning') {
      timeContext = isArabic ? 'صباحاً' : 'in the morning';
    } else if (message_type === 'noon') {
      timeContext = isArabic ? 'ظهراً' : 'at noon';
    } else {
      timeContext = isArabic ? 'مساءً' : 'in the evening';
    }
    
    let progressContext = '';
    if (todaySteps >= 10000) {
      progressContext = isArabic 
        ? 'المستخدم حقق هدف 10,000 خطوة اليوم.' 
        : 'The user achieved their 10,000 steps goal today.';
    } else if (todaySteps >= 5000) {
      progressContext = isArabic 
        ? 'المستخدم سار في طريقه لتحقيق الهدف اليومي.' 
        : 'The user is on track to achieve their daily goal.';
    } else {
      progressContext = isArabic 
        ? 'المستخدم لم يحقق خطوات كثيرة اليوم بعد.' 
        : 'The user hasn\'t achieved many steps today yet.';
    }
    
    if (isArabic) {
      return `زمن الرسالة: ${timeContext}
حالة النشاط: ${progressContext}
خطوات اليوم: ${todaySteps}
المتوسط الأسبوعي: ${weeklyAvg} خطوة
دقائق MVPA اليوم: ${todayMVPA}

اكتب رسالة تحفيزية قصيرة (30-50 كلمة) مناسبة لهذا الوضع.`;
    } else {
      return `Message time: ${timeContext}
Activity status: ${progressContext}
Today's steps: ${todaySteps}
Weekly average: ${weeklyAvg} steps
Today's MVPA minutes: ${todayMVPA}

Write a short motivational message (30-50 words) appropriate for this situation.`;
    }
  }

  getTemplateMessage(culturalProfile, activityData, message_type) {
    // Fallback to template-based messages (existing system)
    const religiousAffiliation = culturalProfile?.religious_affiliation || 'general';
    const language = culturalProfile?.language || 'ar';
    const todaySteps = activityData?.steps || 0;
    const weeklyAvg = todaySteps; // For now, use today's steps as proxy
    const isArabic = language === 'ar';
    
    if (religiousAffiliation === 'islam') {
      return this.getIslamicMessages(isArabic, message_type, todaySteps, weeklyAvg)[0];
    } else {
      return this.getGeneralMessages(isArabic, message_type, todaySteps, weeklyAvg)[0];
    }
  }

  getIslamicMessages(isArabic, message_type, todaySteps, weeklyAvg) {
    if (isArabic) {
      if (message_type === 'morning') {
        return [
          'بسم الله الرحمن الرحيم، ابدأ يومك بحركة بسيطة واحتسبها عبادة.',
          'صباح الخير! كل خطوة تخطوها نحو صحتك هي عبادة وطاعة.',
          'يا بشر، جسدك أمانة من الله فاعتني به ببعض الحركة اليوم.',
        ];
      } else if (message_type === 'noon') {
        return [
          'استمر في جهودك! الحركة في منتصف اليوم تزيد من طاقتك للعبادة.',
          'وقت رائع للاستراحة مع بعض الحركة الخفيفة.',
          'لا تنس أن الصحة نعمة، فاحمها بالنشاط البدني.',
        ];
      } else { // evening
        if (todaySteps >= 10000) {
          return [
            'ما شاء الله! لقد حققت إنجازاً عظيماً اليوم. جزاك الله خيراً.',
            'أحسنت! هذا التزام رائع بالصحة والنشاط.',
          ];
        } else {
          return [
            'أحسنت على مجهودك اليوم! غداً يوم جديد لزيادة نشاطك.',
            'استمر في المحاولة، كل خطوة تقربك من الهدف.',
          ];
        }
      }
    } else {
      // English Islamic messages
      if (message_type === 'morning') {
        return [
          'Start your day with movement and count it as worship.',
          'Good morning! Every step towards your health is an act of devotion.',
        ];
      } else if (message_type === 'noon') {
        return [
          'Keep up your efforts! Mid-day movement increases your energy for worship.',
          'Great time for a rest with some light movement.',
        ];
      } else {
        if (todaySteps >= 10000) {
          return [
            'MashaAllah! You have achieved something great today. May Allah reward you.',
            'Excellent! This is wonderful commitment to health and activity.',
          ];
        } else {
          return [
            'Well done on your effort today! Tomorrow is a new day to increase your activity.',
            'Keep trying, every step brings you closer to your goal.',
          ];
        }
      }
    }
  }

  getGeneralMessages(isArabic, message_type, todaySteps, weeklyAvg) {
    if (isArabic) {
      if (message_type === 'morning') {
        return [
          'صباح الخير! ابدأ يومك بحركة بسيطة لزيادة طاقتك.',
          'يوم جديد مليء بالفرص! انطلق ببعض الخطوات.',
        ];
      } else if (message_type === 'noon') {
        return [
          'وقت رائع للتحرك قليلاً حتى لو كانت خطوات قليلة.',
          'استراحة نشطة مفيدة لجسمك وعقلك.',
        ];
      } else {
        if (todaySteps >= 10000) {
          return [
            'أحسنت! لقد حققت هدفك اليومي بشكل ممتاز.',
            'عمل رائع! استمر في هذا التزامك.',
          ];
        } else {
          return [
            'عمل جيد اليوم! كل خطوة مهمة.',
            'استمر في المحاولة، أنت تقوم بعمل عظيم.',
          ];
        }
      }
    } else {
      if (message_type === 'morning') {
        return [
          'Good morning! Start your day with simple movement to boost your energy.',
          'A new day full of opportunities! Get moving with some steps.',
        ];
      } else if (message_type === 'noon') {
        return [
          'Great time to move a little, even if just a few steps.',
          'Active rest is beneficial for your body and mind.',
        ];
      } else {
        if (todaySteps >= 10000) {
          return [
            'Excellent! You have achieved your daily goal perfectly.',
            'Great work! Keep up this commitment.',
          ];
        } else {
          return [
            'Good work today! Every step matters.',
            'Keep trying, you are doing great work.',
          ];
        }
      }
    }
  }

  async scheduleMessages(userId) {
    // Schedule messages for 7 AM, 12 PM, and 6 PM
    const messageTypes = ['morning', 'noon', 'evening'];
    
    for (const messageType of messageTypes) {
      const flagName = messageType === 'morning' ? 'morning_notifications' : 
                      messageType === 'noon' ? 'noon_notifications' : 'evening_notifications';
      const enabled = await this.isFeatureEnabled(flagName);
      if (enabled) {
        await this.generateMessage(null, null, messageType);
      }
    }
  }
}

module.exports = new AIMessageService();
