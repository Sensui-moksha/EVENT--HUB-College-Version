/**
 * Account Approval Email Template
 * Sent when admin approves a user's registration
 */

const accountApprovalTemplate = (username, email) => {
  const appName = process.env.APP_NAME || 'EventHub';
  const frontendUrl = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  const loginUrl = `${frontendUrl}/login`;
  
  const subject = '🎉 Your EventHub Account Has Been Approved!';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Account Approved</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                    ✅ Account Approved!
                  </h1>
                </td>
              </tr>
              
              <!-- Content -->
              <tr>
                <td style="padding: 40px;">
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Hi <strong>${username}</strong>,
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    Great news! Your EventHub account has been <strong style="color: #10b981;">approved</strong> by our administrator.
                  </p>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    You now have full access to:
                  </p>
                  
                  <ul style="margin: 0 0 20px; padding-left: 20px; color: #333333; font-size: 16px; line-height: 1.8;">
                    <li>Browse and discover events</li>
                    <li>Register for events that interest you</li>
                    <li>Receive event notifications and updates</li>
                    <li>Manage your profile and preferences</li>
                  </ul>
                  
                  <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
                      Login to EventHub
                    </a>
                  </div>
                  
                  <p style="margin: 20px 0 0; color: #999999; font-size: 14px; line-height: 1.6; text-align: center;">
                    If the button doesn't work, copy and paste this link:<br>
                    <a href="${loginUrl}" style="color: #10b981;">${loginUrl}</a>
                  </p>
                  
                  <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                    <strong>Your Account Details:</strong>
                  </p>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Email: ${email}<br>
                    Status: <span style="color: #10b981; font-weight: 600;">Active</span>
                  </p>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="padding: 30px 40px; background-color: #2c3e50; border-radius: 0 0 8px 8px; text-align: center;">
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
                    © ${new Date().getFullYear()} EventHub. All rights reserved. | This is an automated message.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
  
  const text = `
Account Approved!

Hi ${username},

Great news! Your EventHub account has been approved by our administrator.

You now have full access to:
- Browse and discover events
- Register for events that interest you
- Receive event notifications and updates
- Manage your profile and preferences

Your Account Details:
Email: ${email}
Status: Active

You can now login to EventHub and start exploring events!

This is an automated message from EventHub.
© ${new Date().getFullYear()} EventHub. All rights reserved.
  `;
  
  return { subject, html, text };
};

export default accountApprovalTemplate;
