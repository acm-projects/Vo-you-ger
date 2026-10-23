// Development helper: no database access unless explicitly enabled.
require("dotenv").config({path:require('node:path').resolve(__dirname,'../.env'),quiet:true});

async function main() {
  if(!process.argv.includes('--allow-write')) {
    console.log('Dry run. To create a development user, set TEST_USER_EMAIL and TEST_USER_PASSWORD, then pass --allow-write against a development table.');
    return;
  }
  const email=process.env.TEST_USER_EMAIL,password=process.env.TEST_USER_PASSWORD;
  if(!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !password || password.length<12) throw new Error('Set a valid TEST_USER_EMAIL and a TEST_USER_PASSWORD of at least 12 characters');
  const {createUser,findUserByEmail}=require('../models/userModel');
  const existing=await findUserByEmail(email);
  if(existing) {console.log('The development user already exists; no password or profile was changed. Sign in through the normal login flow.');return;}
  const passwordHash=await require('bcryptjs').hash(password,10);
  await createUser({fName:'Test',lName:'User',email,passwordHash,nationalities:['United States'],quizResponse:null});
  console.log('Development user created. Sign in through the normal login flow; credentials and tokens are not printed.');
}
main().catch(()=>{console.error('Development user setup failed. Check the development configuration; sensitive details are omitted.');process.exitCode=1;});
