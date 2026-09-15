const http = require('http');

const API_URL = 'localhost';
const API_PORT = 3000;

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: API_URL,
      port: API_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          resolve(response);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

async function testInvitationFlow() {
  try {
    console.log('=== اختبار تدفق الدعوة الكامل ===\n');

    // 1. Login as inviter
    console.log('1. تسجيل الدخول كمدعو...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    const inviterToken = loginResponse.token;
    const inviterId = loginResponse.user.id;
    console.log('✅ تم تسجيل الدخول، ID المستخدم:', inviterId);

    // 2. Create invitation
    console.log('\n2. إنشاء دعوة...');
    const createResponse = await makeRequest('POST', '/api/invitations', {
      invitation_type: 'friend',
      invitee_email: 'newuser@example.com'
    }, inviterToken);
    console.log('✅ تم إنشاء الدعوة:', createResponse.invitation.invite_code);
    const inviteCode = createResponse.invitation.invite_code;

    // 3. Get inviter's progress (what invitee will see)
    console.log('\n3. الحصول على تقدم المدعو...');
    const progressResponse = await makeRequest('GET', `/api/social/user/${inviterId}/progress`);
    console.log('✅ تقدم المدعو:');
    console.log('   - النقاط:', progressResponse.gamification?.total_points || 0);
    console.log('   - المستوى:', progressResponse.gamification?.current_level || 'N/A');
    console.log('   - الخطوات الأسبوعية:', progressResponse.weekly_stats?.total_steps || 0);
    console.log('   - التمارين المكتملة:', progressResponse.weekly_stats?.exercises_completed || 0);

    // 4. Register new user with invite code
    console.log('\n4. تسجيل مستخدم جديد مع كود الدعوة...');
    const registerResponse = await makeRequest('POST', '/api/auth/register', {
      email: 'newuser@example.com',
      password: 'newpassword123',
      language: 'ar',
      invite_code: inviteCode
    });
    console.log('✅ تم التسجيل بنجاح');
    console.log('   - معلومات المدعو:', registerResponse.inviter?.participant_code);
    const newUserToken = registerResponse.token;
    const newUserId = registerResponse.user.id;

    // 5. Get available emojis
    console.log('\n5. الحصول على الإيموجي المتاحة...');
    const emojisResponse = await makeRequest('GET', '/api/social/emojis');
    console.log('✅ الإيموجي المتاحة:', Object.keys(emojisResponse.emojis));

    // 6. Send reaction to inviter
    console.log('\n6. إرسال إيموجي للمدعو...');
    const reactionResponse = await makeRequest('POST', '/api/social/reactions', {
      receiver_id: inviterId,
      emoji: '👍',
      reaction_type: 'encouragement'
    }, newUserToken);
    console.log('✅ تم إرسال الإيموجي:', reactionResponse.reaction.emoji);

    // 7. Get reactions for inviter
    console.log('\n7. الحصول على التفاعلات للمدعو...');
    const reactionsResponse = await makeRequest('GET', '/api/social/reactions', null, inviterToken);
    console.log('✅ عدد التفاعلات:', reactionsResponse.reactions.length);
    if (reactionsResponse.reactions.length > 0) {
      console.log('   - آخر إيموجي:', reactionsResponse.reactions[0].emoji);
      console.log('   - من:', reactionsResponse.reactions[0].sender_code);
    }

    // 8. Check invitation stats
    console.log('\n8. التحقق من إحصائيات الدعوات...');
    const statsResponse = await makeRequest('GET', '/api/invitations/stats', null, inviterToken);
    console.log('✅ إحصائيات الدعوات:');
    console.log('   - إجمالي الدعوات:', statsResponse.stats.total_invitations);
    console.log('   - الدعوات المقبولة:', statsResponse.stats.accepted_invitations);
    console.log('   - النقاط المكتسبة:', statsResponse.stats.total_reward_points);

    console.log('\n✅✅✅ تم اختبار التدفق الكامل بنجاح!');
  } catch (error) {
    console.error('❌ فشل الاختبار:', error.message);
  }
}

testInvitationFlow();
