/**
 * Account Rejection Email Template
 * Sent when admin rejects/declines a user's registration
 */

const accountRejectionTemplate = (username, email, reason = null) => {
  const subject = '❌ Your EventHub Registration Was Not Approved';
  
  const reasonText = reason 
    ? `<p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
        <strong>Reason provided:</strong><br>
        <span style="color: #666666; font-style: italic;">"${reason}"</span>
      </p>`
    : '';
  
  const reasonPlainText = reason 
    ? `\nReason provided:\n"${reason}"\n`
    : '';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Registration Not Approved</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
      <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
          <td align="center" style="padding: 40px 0;">
            <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
              <!-- Header -->
              <tr>
                <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 8px 8px 0 0;">
                  <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">
                    Registration Not Approved
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
                    We regret to inform you that your registration request for EventHub has been <strong style="color: #ef4444;">declined</strong> by our administrator.
                  </p>
                  
                  ${reasonText}
                  
                  <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 15px 20px; margin: 20px 0; border-radius: 0 4px 4px 0;">
                    <p style="margin: 0; color: #991b1b; font-size: 14px; line-height: 1.6;">
                      <strong>What this means:</strong><br>
                      Your account has been removed from our system. If you believe this was a mistake or would like to appeal this decision, please contact the administrator.
                    </p>
                  </div>
                  
                  <p style="margin: 0 0 20px; color: #333333; font-size: 16px; line-height: 1.6;">
                    You may register again with correct information if you believe there was an error in your initial registration.
                  </p>
                  
                  <p style="margin: 0 0 10px; color: #666666; font-size: 14px; line-height: 1.6;">
                    <strong>Registration Details:</strong>
                  </p>
                  <p style="margin: 0 0 20px; color: #666666; font-size: 14px; line-height: 1.6;">
                    Email: ${email}<br>
                    Status: <span style="color: #ef4444; font-weight: 600;">Declined</span>
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
                    © ${new Date().getFullYear()} EventHub. All rights reserved.
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
Registration Not Approved

Hi ${username},

We regret to inform you that your registration request for EventHub has been declined by our administrator.
${reasonPlainText}
What this means:
Your account has been removed from our system. If you believe this was a mistake or would like to appeal this decision, please contact the administrator.

You may register again with correct information if you believe there was an error in your initial registration.

Registration Details:
Email: ${email}
Status: Declined

If you have questions, please contact the event administrator.

© ${new Date().getFullYear()} EventHub. All rights reserved.
  `;
  
  return { subject, html, text };
};

export default accountRejectionTemplate;
