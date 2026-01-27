/**
 * Admin Notification Email Template
 * Used for notifying admins about new registrations and events
 */

const adminNotificationTemplate = (notifications) => {
  const appName = process.env.APP_NAME || 'EventHub';
  const frontendUrl = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const {
    type, // 'user_registration', 'event_registration', 'summary'
    data,
    summary = [], // For aggregated notifications
  } = notifications;

  const generateSingleNotification = () => {
    if (type === 'user_registration') {
      return {
        title: 'New User Registration',
        icon: '👤',
        details: `
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Username:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${data.username}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Email:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${data.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Registered At:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${new Date(data.registeredAt || Date.now()).toLocaleString()}</td>
          </tr>
        `,
      };
    }
    
    if (type === 'event_registration') {
      return {
        title: 'New Event Registration',
        icon: '🎫',
        details: `
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>User:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${data.username}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Event:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${data.eventName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;"><strong>Registered At:</strong></td>
            <td style="padding: 8px 0; color: #666666; font-size: 14px;">${new Date(data.registeredAt || Date.now()).toLocaleString()}</td>
          </tr>
        `,
      };
    }
    
    return { title: 'Notification', icon: '📢', details: '' };
  };

  const generateSummaryContent = () => {
    const userRegs = summary.filter(n => n.type === 'user_registration');
    const eventRegs = summary.filter(n => n.type === 'event_registration');
    
    let content = '';
    
    if (userRegs.length > 0) {
      content += `
        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px; color: #333333; font-size: 16px; font-weight: 600;">
            👤 New User Registrations (${userRegs.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px;">
            <thead>
              <tr style="background-color: #e9ecef;">
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">Username</th>
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">Email</th>
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${userRegs.map(n => `
                <tr style="border-bottom: 1px solid #dee2e6;">
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${n.data.username}</td>
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${n.data.email}</td>
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${new Date(n.data.registeredAt || n.timestamp).toLocaleTimeString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    if (eventRegs.length > 0) {
      content += `
        <div style="margin-bottom: 25px;">
          <h3 style="margin: 0 0 15px; color: #333333; font-size: 16px; font-weight: 600;">
            🎫 New Event Registrations (${eventRegs.length})
          </h3>
          <table style="width: 100%; border-collapse: collapse; background-color: #f8f9fa; border-radius: 8px;">
            <thead>
              <tr style="background-color: #e9ecef;">
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">User</th>
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">Event</th>
                <th style="padding: 12px; text-align: left; color: #666666; font-size: 12px; font-weight: 600;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${eventRegs.map(n => `
                <tr style="border-bottom: 1px solid #dee2e6;">
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${n.data.username}</td>
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${n.data.eventName}</td>
                  <td style="padding: 12px; color: #666666; font-size: 14px;">${new Date(n.data.registeredAt || n.timestamp).toLocaleTimeString()}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
    
    return content;
  };

  const isSummary = type === 'summary' && summary.length > 0;
  const notificationInfo = isSummary ? null : generateSingleNotification();
  
  const subject = isSummary 
    ? `${appName} Daily Summary: ${summary.length} new notification(s)`
    : `${appName} Admin Alert: ${notificationInfo.title}`;

  return {
    subject,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Notification</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 0;">
        <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); border-radius: 10px 10px 0 0;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">${appName} Admin</h1>
              <p style="margin: 5px 0 0; color: #a0a0a0; font-size: 12px;">Admin Notification System</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              ${isSummary ? `
                <h2 style="margin: 0 0 10px; color: #333333; font-size: 22px; font-weight: 600;">📊 Daily Activity Summary</h2>
                <p style="margin: 0 0 25px; color: #666666; font-size: 14px;">
                  Here's a summary of today's activity on ${appName}
                </p>
                ${generateSummaryContent()}
              ` : `
                <div style="text-align: center; margin-bottom: 25px;">
                  <span style="font-size: 48px;">${notificationInfo.icon}</span>
                  <h2 style="margin: 15px 0 0; color: #333333; font-size: 22px; font-weight: 600;">${notificationInfo.title}</h2>
                </div>
                
                <div style="background-color: #f8f9fa; border-radius: 10px; padding: 20px; border-left: 4px solid #667eea;">
                  <table style="width: 100%; border-collapse: collapse;">
                    ${notificationInfo.details}
                  </table>
                </div>
              `}
              
              <!-- Dashboard Link -->
              <div style="text-align: center; margin: 30px 0 0;">
                <a href="${frontendUrl}/dashboard" style="display: inline-block; padding: 12px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 25px; font-size: 14px; font-weight: 600;">
                  Go to Dashboard
                </a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 10px 10px; text-align: center;">
              <p style="margin: 0; color: #999999; font-size: 12px;">
                © ${new Date().getFullYear()} ${appName}. All rights reserved.
              </p>
              <p style="margin: 10px 0 0; color: #999999; font-size: 11px;">
                You received this email because you are an admin of ${appName}.
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
    text: isSummary 
      ? `${appName} Daily Summary\n\nTotal notifications: ${summary.length}\n\n${summary.map(n => `- ${n.type}: ${JSON.stringify(n.data)}`).join('\n')}`
      : `${appName} Admin Alert: ${notificationInfo.title}\n\n${JSON.stringify(data, null, 2)}`,
  };
};

export default adminNotificationTemplate;
