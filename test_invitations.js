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

async function testInvitations() {
  try {
    // 1. Login
    console.log('1. Logging in...');
    const loginResponse = await makeRequest('POST', '/api/auth/login', {
      email: 'test@example.com',
      password: 'password123'
    });
    const token = loginResponse.token;
    console.log('✅ Login successful');

    // 2. Create invitation
    console.log('\n2. Creating invitation...');
    const createResponse = await makeRequest('POST', '/api/invitations', {
      invitation_type: 'friend',
      invitee_email: 'friend@example.com'
    }, token);
    console.log('✅ Invitation created:', createResponse);
    const inviteCode = createResponse.invitation.invite_code;

    // 3. Get user invitations
    console.log('\n3. Getting user invitations...');
    const invitationsResponse = await makeRequest('GET', '/api/invitations', null, token);
    console.log('✅ User invitations:', invitationsResponse);

    // 4. Get invitation stats
    console.log('\n4. Getting invitation statistics...');
    const statsResponse = await makeRequest('GET', '/api/invitations/stats', null, token);
    console.log('✅ Invitation stats:', statsResponse);

    // 5. Validate invitation
    console.log('\n5. Validating invitation...');
    const validateResponse = await makeRequest('GET', `/api/invitations/${inviteCode}/validate`);
    console.log('✅ Invitation valid:', validateResponse);

    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testInvitations();
