// trigger-test-lead.js - Test script to send a sample lead email
const fs = require('fs');
const path = require('path');

// NUCLEAR OPTION: Manual .env parser (bypasses dotenv's Windows bullshit)
function loadEnvManually(envPath) {
  try {
    let raw = fs.readFileSync(envPath, 'utf8');
    
    console.log('📄 File size:', raw.length, 'bytes');
    console.log('📄 First 100 chars:', JSON.stringify(raw.substring(0, 100)));
    
    // Remove BOM if present
    if (raw.charCodeAt(0) === 0xFEFF) {
      console.log('⚠️ Found BOM, removing...');
      raw = raw.slice(1);
    }
    
    // Split by any line ending (Windows CRLF or Unix LF)
    const lines = raw.split(/\r?\n/);
    console.log('📄 Total lines:', lines.length);
    
    let parsed = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        if (trimmed) console.log(`   Line ${i}: SKIP (comment/empty):`, trimmed.substring(0, 50));
        continue;
      }
      
      // Find the first = sign
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        console.log(`   Line ${i}: SKIP (no =):`, trimmed.substring(0, 50));
        continue;
      }
      
      // Get key and value (trim both)
      const key = trimmed.substring(0, eqIndex).trim();
      if (!key) {
        continue; // Skip if no key name
      }
      
      const value = trimmed.substring(eqIndex + 1).trim();
      
      // Remove quotes if present
      const cleanValue = value.replace(/^["']|["']$/g, '');
      
      // Set it directly (even if empty - blank values are valid)
      process.env[key] = cleanValue;
      parsed++;
      
      // Highlight important ones
      if (key === 'BUSINESS_OWNER_EMAIL' || key === 'EMAIL_APP_PASSWORD') {
        console.log(`   ✅ FOUND ${key}: ${cleanValue ? cleanValue.substring(0, 30) + '...' : '(empty - THIS IS THE PROBLEM!)'}`);
      } else if (cleanValue === '') {
        // Log blank variables but don't spam
        if (i < 20) console.log(`   Line ${i}: ${key} = (empty)`);
      }
    }
    
    console.log(`✅ Manual .env parser loaded ${parsed} variables`);
    
    // Final check for critical vars
    if (!process.env.BUSINESS_OWNER_EMAIL) {
      console.error('❌ CRITICAL: BUSINESS_OWNER_EMAIL not found in .env file!');
    }
    if (!process.env.EMAIL_APP_PASSWORD) {
      console.error('❌ CRITICAL: EMAIL_APP_PASSWORD not found in .env file!');
    }
    
    return true;
  } catch (err) {
    console.error('❌ Manual .env load failed:', err.message);
    console.error(err.stack);
    return false;
  }
}

// Load .env from root directory
const envPath = path.resolve(__dirname, '..', '.env');
console.log('📍 Loading .env from:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('❌ .env file not found at:', envPath);
  process.exit(1);
}

// Use manual parser
loadEnvManually(envPath);

// VERIFY IT WORKED
console.log('\n🔍 VERIFICATION:');
console.log('   BUSINESS_OWNER_EMAIL:', process.env.BUSINESS_OWNER_EMAIL || '❌ NOT SET');
console.log('   EMAIL_APP_PASSWORD:', process.env.EMAIL_APP_PASSWORD ? `SET (${process.env.EMAIL_APP_PASSWORD.length} chars)` : '❌ NOT SET');
console.log('');

// Also load via phone_server.js (it will use the env vars we just set)
const { sendEmailNotification, businessConfig } = require('./phone_server.js');

async function testLeadEmail() {
  console.log('🧪 Testing lead email notification...\n');
  
  // Set business name for the test
  businessConfig.name = 'Springer Roofing';
  
  // Dummy lead data
  const callDetails = {
    customerName: 'Springer Roofing Lead (Airport Test)',
    phoneNumber: '+17146550688',
    serviceNeeded: 'Full Roof Replacement - Emergency Leak',
    urgency: 'high'
  };
  
  const callSid = 'TEST_' + Date.now();
  
  console.log('📋 Test Lead Data:');
  console.log(JSON.stringify(callDetails, null, 2));
  console.log('\n📧 Sending email...\n');
  
  try {
    const result = await sendEmailNotification(callDetails, callSid);
    
    if (result) {
      console.log('\n✅ SUCCESS! Check your inbox for the HTML lead email.');
    } else {
      console.log('\n❌ Email sending failed. Check your .env file for:');
      console.log('   - BUSINESS_OWNER_EMAIL');
      console.log('   - EMAIL_APP_PASSWORD');
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
  
  // Exit after sending
  process.exit(0);
}

// Run the test
testLeadEmail();
