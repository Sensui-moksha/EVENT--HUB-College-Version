/**
 * Event Registration Confirmation Email Template
 * Beautiful, professional design with event image
 */

const eventRegistrationTemplate = (username, eventDetails) => {
  const appName = process.env.APP_NAME || 'EventHub';
  const frontendUrl = process.env.WEBSITE_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
  
  const {
    eventName,
    eventDate,
    eventTime,
    location,
    eventId,
    registrationId,
    eventImage,
    eventDescription,
    category,
    organizerName,
  } = eventDetails;

  const eventUrl = `${frontendUrl}/events/${eventId}`;
  const formattedDate = eventDate ? new Date(eventDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }) : 'Date to be announced';
  
  // Default placeholder image if no event image
  const imageUrl = eventImage || `${frontendUrl}/placeholder-event.jpg`;
  
  // Category badge colors
  const categoryColors = {
    'Technical': { bg: '#3b82f6', text: '#ffffff' },
    'Cultural': { bg: '#ec4899', text: '#ffffff' },
    'Sports': { bg: '#22c55e', text: '#ffffff' },
    'Workshop': { bg: '#f59e0b', text: '#ffffff' },
    'Seminar': { bg: '#8b5cf6', text: '#ffffff' },
    'default': { bg: '#6b7280', text: '#ffffff' }
  };
  const catColor = categoryColors[category] || categoryColors.default;
  
  return {
    subject: `🎉 You're In! Registration Confirmed for ${eventName}`,
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Registration Confirmed - ${eventName}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f0f2f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 600px; max-width: 100%; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12); overflow: hidden;">
          
          <!-- Header with App Branding -->
          <tr>
            <td style="padding: 30px 40px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
              <h1 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">${appName}</h1>
              <p style="margin: 8px 0 0; color: rgba(255,255,255,0.9); font-size: 14px;">Your Gateway to Amazing Events</p>
            </td>
          </tr>
          
          <!-- Event Image Banner -->
          ${eventImage ? `
          <tr>
            <td style="padding: 0;">
              <div style="position: relative;">
                <img src="${imageUrl}" alt="${eventName}" style="width: 100%; height: 220px; object-fit: cover; display: block;" />
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(transparent, rgba(0,0,0,0.7)); padding: 30px 25px 20px;">
                  ${category ? `<span style="display: inline-block; background-color: ${catColor.bg}; color: ${catColor.text}; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">${category}</span>` : ''}
                </div>
              </div>
            </td>
          </tr>
          ` : ''}
          
          <!-- Success Icon & Title -->
          <tr>
            <td style="padding: ${eventImage ? '30px' : '40px'} 40px 20px; text-align: center;">
              <div style="display: inline-block; width: 80px; height: 80px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; margin-bottom: 20px; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.3);">
                <span style="font-size: 40px; line-height: 80px; display: block;">✓</span>
              </div>
              <h2 style="margin: 0 0 10px; color: #1a1a2e; font-size: 26px; font-weight: 700;">You're All Set!</h2>
              <p style="margin: 0; color: #10b981; font-size: 15px; font-weight: 600;">Registration Confirmed Successfully</p>
            </td>
          </tr>
          
          <!-- Greeting -->
          <tr>
            <td style="padding: 10px 40px 25px;">
              <p style="margin: 0; color: #4a5568; font-size: 16px; line-height: 1.7; text-align: center;">
                Hello <strong style="color: #1a1a2e;">${username}</strong>! 👋<br>
                We're thrilled to confirm your spot at this exciting event.
              </p>
            </td>
          </tr>
          
          <!-- Event Details Card -->
          <tr>
            <td style="padding: 0 40px 30px;">
              <div style="background: linear-gradient(145deg, #f8fafc 0%, #eef2f7 100%); border-radius: 16px; padding: 28px; border: 1px solid #e2e8f0;">
                <h3 style="margin: 0 0 20px; color: #1a1a2e; font-size: 20px; font-weight: 700; border-bottom: 2px solid #667eea; padding-bottom: 12px;">
                  📌 ${eventName}
                </h3>
                
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top;">
                            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 10px; text-align: center; line-height: 36px;">
                              <span style="font-size: 16px;">📅</span>
                            </div>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Date</span><br>
                            <span style="color: #1a1a2e; font-size: 15px; font-weight: 600;">${formattedDate}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  
                  ${eventTime ? `
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top;">
                            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 10px; text-align: center; line-height: 36px;">
                              <span style="font-size: 16px;">🕐</span>
                            </div>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Time</span><br>
                            <span style="color: #1a1a2e; font-size: 15px; font-weight: 600;">${eventTime}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                  
                  ${location ? `
                  <tr>
                    <td style="padding: 12px 0; border-bottom: 1px solid #e2e8f0;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top;">
                            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 10px; text-align: center; line-height: 36px;">
                              <span style="font-size: 16px;">📍</span>
                            </div>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Venue</span><br>
                            <span style="color: #1a1a2e; font-size: 15px; font-weight: 600;">${location}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                  
                  ${registrationId ? `
                  <tr>
                    <td style="padding: 12px 0;">
                      <table style="width: 100%;">
                        <tr>
                          <td style="width: 40px; vertical-align: top;">
                            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 10px; text-align: center; line-height: 36px;">
                              <span style="font-size: 16px;">🎫</span>
                            </div>
                          </td>
                          <td style="padding-left: 12px; vertical-align: middle;">
                            <span style="color: #718096; font-size: 12px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Confirmation Code</span><br>
                            <span style="color: #1a1a2e; font-size: 15px; font-weight: 600; font-family: 'Courier New', monospace; background: #e0e7ff; padding: 2px 8px; border-radius: 4px;">${String(registrationId).substring(0, 8).toUpperCase()}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  ` : ''}
                </table>
              </div>
            </td>
          </tr>
          
          <!-- QR Code Notice -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <div style="background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%); border-radius: 12px; padding: 20px 25px; border: 1px solid #a7f3d0;">
                <table style="width: 100%;">
                  <tr>
                    <td style="width: 50px; vertical-align: top;">
                      <span style="font-size: 32px;">📱</span>
                    </td>
                    <td style="padding-left: 10px;">
                      <h4 style="margin: 0 0 6px; color: #065f46; font-size: 15px; font-weight: 700;">Your Digital Pass is Ready!</h4>
                      <p style="margin: 0; color: #047857; font-size: 14px; line-height: 1.5;">
                        A QR code has been generated for your registration. Simply show it at the venue for instant check-in. No printing required!
                      </p>
                    </td>
                  </tr>
                </table>
              </div>
            </td>
          </tr>
          
          <!-- What's Next Section -->
          <tr>
            <td style="padding: 0 40px 25px;">
              <h4 style="margin: 0 0 15px; color: #1a1a2e; font-size: 16px; font-weight: 700;">📋 What's Next?</h4>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: #667eea; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 10px;">1</span>
                    Add the event to your calendar
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: #667eea; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 10px;">2</span>
                    Keep your QR code handy on event day
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #4a5568; font-size: 14px; line-height: 1.6;">
                    <span style="display: inline-block; width: 24px; height: 24px; background: #667eea; color: white; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 10px;">3</span>
                    Arrive 10-15 minutes early for smooth check-in
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- CTA Button -->
          <tr>
            <td style="padding: 0 40px 35px; text-align: center;">
              <a href="${eventUrl}" style="display: inline-block; padding: 16px 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 30px; font-size: 16px; font-weight: 700; box-shadow: 0 8px 25px rgba(102, 126, 234, 0.35); transition: all 0.3s ease;">
                View Event & QR Code
              </a>
              <p style="margin: 15px 0 0; color: #a0aec0; font-size: 13px;">
                Or copy: <a href="${eventUrl}" style="color: #667eea; text-decoration: none;">${eventUrl}</a>
              </p>
            </td>
          </tr>
          
          <!-- Divider -->
          <tr>
            <td style="padding: 0 40px;">
              <div style="height: 1px; background: linear-gradient(to right, transparent, #e2e8f0, transparent);"></div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #2c3e50; text-align: center;">
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
                © ${new Date().getFullYear()} ${appName}. Made with ❤️ for event enthusiasts.
              </p>
            </td>
          </tr>
        </table>
        
        <!-- Social/Unsubscribe Links -->
        <table role="presentation" style="width: 600px; max-width: 100%; margin-top: 20px;">
          <tr>
            <td style="text-align: center;">
              <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                <a href="${frontendUrl}/settings" style="color: #667eea; text-decoration: none;">Manage Notifications</a>
                &nbsp;•&nbsp;
                <a href="${frontendUrl}" style="color: #667eea; text-decoration: none;">Visit ${appName}</a>
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
    text: `🎉 YOU'RE IN! REGISTRATION CONFIRMED

Hello ${username}!

We're thrilled to confirm your spot at this exciting event.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 ${eventName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 Date: ${formattedDate}
${eventTime ? `🕐 Time: ${eventTime}` : ''}
${location ? `📍 Venue: ${location}` : ''}
${registrationId ? `🎫 Confirmation Code: ${String(registrationId).substring(0, 8).toUpperCase()}` : ''}
${category ? `🏷️ Category: ${category}` : ''}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📱 YOUR DIGITAL PASS IS READY!
A QR code has been generated for your registration. 
Show it at the venue for instant check-in.

📋 WHAT'S NEXT?
1. Add the event to your calendar
2. Keep your QR code handy on event day
3. Arrive 10-15 minutes early for smooth check-in

🔗 View Event & QR Code: ${eventUrl}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? Contact the event organizer through the app.

© ${new Date().getFullYear()} ${appName}
Made with ❤️ for event enthusiasts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
EventHub - Event Management System
Developed by Mokshyagna Yadav
Department of Computer Science and Engineering
DVR & Dr. HS MIC College of Technology
    `,
  };
};

export default eventRegistrationTemplate;
