/**
 * Welcome Email Template
 * Sent after successful user registration
 */

const welcomeTemplate = (username, email) => {
  const appName = process.env.APP_NAME || 'EventHub';
  const frontendUrl = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/login`;
  
  return {
    subject: `Welcome to ${appName}! 🎉`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${appName}</title>
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
          
          <!-- Welcome Banner -->
          <tr>
            <td style="padding: 40px 40px 20px; text-align: center;">
              <div style="font-size: 60px; margin-bottom: 20px;">🎉</div>
              <h2 style="margin: 0; color: #333333; font-size: 28px; font-weight: 600;">Welcome Aboard!</h2>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 20px 40px 40px;">
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Hello <strong>${username}</strong>,
              </p>
              <p style="margin: 0 0 20px; color: #666666; font-size: 16px; line-height: 1.6;">
                Thank you for joining ${appName}! We're thrilled to have you as part of our community.
              </p>
              <p style="margin: 0 0 30px; color: #666666; font-size: 16px; line-height: 1.6;">
                Your account has been successfully created with the email: <strong>${email}</strong>
              </p>
              
              <!-- Features Section -->
              <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; margin: 20px 0;">
                <h3 style="margin: 0 0 15px; color: #333333; font-size: 18px;">What you can do now:</h3>
                <ul style="margin: 0; padding-left: 20px; color: #666666; font-size: 14px; line-height: 2;">
                  <li>Browse and discover exciting events</li>
                  <li>Register for events with one click</li>
                  <li>Get QR codes for quick check-in</li>
                  <li>Stay updated with event notifications</li>
                </ul>
              </div>
              
              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${loginUrl}" style="display: inline-block; padding: 15px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 30px; font-size: 16px; font-weight: 600;">
                  Get Started
                </a>
              </div>
              
              <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                If the button doesn't work, copy and paste this link:<br>
                <a href="${loginUrl}" style="color: #667eea;">${loginUrl}</a>
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
    text: `Welcome to ${appName}!\n\nHello ${username},\n\nThank you for joining ${appName}! Your account has been successfully created with the email: ${email}\n\nGet started by logging in at: ${loginUrl}\n\n© ${new Date().getFullYear()} ${appName}. All rights reserved.`,
  };
};

export default welcomeTemplate;
