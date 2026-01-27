/**
 * OTP Email Template
 */

const otpTemplate = (otp, username, expiryMinutes = 5) => {
  const appName = process.env.APP_NAME || 'EventHub';
  
  return {
    subject: `${otp} is your ${appName} verification code`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verification Code</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">${appName}</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #333333; font-size: 24px; font-weight: 600;">Verification Code</h2>
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Hello${username ? ` ${username}` : ''},
              </p>
              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                Your verification code is:
              </p>
              
              <!-- OTP Box -->
              <div style="text-align: center; margin: 30px 0;">
                <div style="display: inline-block; padding: 20px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px;">
                  <span style="font-size: 36px; font-weight: 700; color: #ffffff; letter-spacing: 8px;">${otp}</span>
                </div>
              </div>
              
              <p style="margin: 30px 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                This code will expire in <strong>${expiryMinutes} minutes</strong>.
              </p>
              <p style="margin: 10px 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                If you didn't request this code, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #2c3e50; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="margin: 0 0 15px; color: #3498db; font-size: 13px; font-weight: 600;">
                EventHub - Event Management System
              </p>
              <p style="margin: 0 0 5px; color: #ecf0f1; font-size: 11px;">
                Developed by Mokshyagna Yadav
              </p>
              <p style="margin: 0 0 5px; color: #bdc3c7; font-size: 11px;">
                Department of Computer Science and Engineering
              </p>
              <p style="margin: 0 0 20px; color: #bdc3c7; font-size: 11px;">
                DVR & Dr. HS MIC College of Technology
              </p>
              <p style="margin: 0; color: #95a5a6; font-size: 11px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved. | This is an automated message, please do not reply.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `,
    text: `Your ${appName} verification code is: ${otp}\n\nThis code will expire in ${expiryMinutes} minutes.\n\nIf you didn't request this code, please ignore this email.`,
  };
};

export default otpTemplate;
