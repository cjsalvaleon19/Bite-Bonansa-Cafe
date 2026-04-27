# Supabase Email Configuration Guide

## Problem
Users are seeing "Email Sent!" message when requesting password reset, but not receiving any emails. This happens because **Supabase email service is not properly configured**.

## Why This Happens

Supabase's `resetPasswordForEmail()` function returns success even when:
- Email service is not configured
- SMTP credentials are missing or invalid
- Email sending fails on the backend

The function only throws an error for client-side validation issues (like invalid email format), not for email delivery failures.

## Solution: Configure Supabase Email Service

### Option 1: Use Supabase's Built-in Email Service (Recommended for Testing)

Supabase provides a built-in email service that works out of the box for development and testing.

1. **Go to Supabase Dashboard**
   - Navigate to your project: https://supabase.com/dashboard
   - Select your project: `Bite-Bonansa-Cafe`

2. **Check Authentication Settings**
   - Go to `Authentication` → `Email Templates`
   - Click on "Reset Password" template
   - You should see the default email template

3. **Verify Email Sending is Enabled**
   - Go to `Authentication` → `Settings`
   - Scroll to "Email Auth"
   - Ensure "Enable Email Confirmations" is toggled ON

4. **Important Limitations of Built-in Service**
   - ⚠️ **Rate Limited**: Max 3 emails per hour per project (free tier)
   - ⚠️ **Not Reliable**: Emails often go to spam or may not be delivered
   - ⚠️ **Development Only**: Not suitable for production use
   - ⚠️ **No Custom Domain**: Emails come from `noreply@mail.app.supabase.io`

### Option 2: Configure Custom SMTP (Recommended for Production)

For production use, you should configure a custom SMTP provider.

#### Recommended SMTP Providers:

1. **SendGrid** (Free tier: 100 emails/day)
   - Website: https://sendgrid.com
   - Reliable delivery
   - Good reputation scores

2. **Mailgun** (Free tier: 5,000 emails/month)
   - Website: https://www.mailgun.com
   - Easy setup
   - Good for transactional emails

3. **Amazon SES** (Very cheap, pay-as-you-go)
   - Website: https://aws.amazon.com/ses/
   - $0.10 per 1,000 emails
   - Requires AWS account

4. **Resend** (Free tier: 3,000 emails/month)
   - Website: https://resend.com
   - Modern API
   - Developer-friendly

#### Steps to Configure Custom SMTP:

1. **Create an Account with Your Chosen Provider**
   - Sign up for one of the providers above
   - Verify your email address
   - Get your SMTP credentials

2. **Get SMTP Credentials**
   
   For **SendGrid**:
   - Go to Settings → API Keys
   - Create an API key
   - SMTP Server: `smtp.sendgrid.net`
   - Port: `587` (TLS) or `465` (SSL)
   - Username: `apikey`
   - Password: Your API key

   For **Mailgun**:
   - Go to Sending → Domain Settings
   - Find SMTP credentials
   - SMTP Server: `smtp.mailgun.org`
   - Port: `587`
   - Username: Your SMTP username
   - Password: Your SMTP password

3. **Configure in Supabase**
   - Go to Supabase Dashboard
   - Navigate to `Project Settings` → `Authentication`
   - Scroll to "SMTP Settings"
   - Enable "Enable Custom SMTP"
   - Fill in the credentials:
     - **SMTP Host**: Your provider's SMTP server
     - **SMTP Port**: Usually `587` (TLS) or `465` (SSL)
     - **SMTP Username**: From your provider
     - **SMTP Password**: From your provider
     - **Sender Email**: Your verified sender email
     - **Sender Name**: "Bite Bonansa Cafe" (or your preferred name)

4. **Verify Domain (Important for Production)**
   - Follow your provider's instructions to verify your domain
   - Add SPF and DKIM records to your DNS
   - This improves email deliverability and prevents spam flags

5. **Test Email Sending**
   - Go to your app's forgot password page
   - Request a password reset
   - Check if the email arrives in your inbox

### Option 3: Use Environment Variables (For Self-Hosted Supabase)

If you're self-hosting Supabase, you can configure SMTP via environment variables:

```env
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your-sendgrid-api-key
SMTP_FROM=noreply@yourdomain.com
```

## Customizing Email Templates

1. **Go to Email Templates**
   - Supabase Dashboard → Authentication → Email Templates
   - Click "Reset Password"

2. **Customize the Template**
   ```html
   <h2>Reset Your Password - Bite Bonansa Cafe</h2>
   
   <p>Hi there,</p>
   
   <p>We received a request to reset your password for your Bite Bonansa Cafe account.</p>
   
   <p>Click the button below to reset your password:</p>
   
   <a href="{{ .ConfirmationURL }}" 
      style="background-color: #ffc107; 
             color: #0a0a0a; 
             padding: 12px 24px; 
             text-decoration: none; 
             border-radius: 6px; 
             font-weight: bold;">
     Reset Password
   </a>
   
   <p>Or copy and paste this link into your browser:</p>
   <p>{{ .ConfirmationURL }}</p>
   
   <p><small>If you didn't request this, you can safely ignore this email.</small></p>
   
   <p>
     Thanks,<br>
     The Bite Bonansa Cafe Team
   </p>
   ```

3. **Available Variables**
   - `{{ .ConfirmationURL }}` - The password reset link
   - `{{ .Email }}` - User's email address
   - `{{ .Token }}` - Reset token (already included in ConfirmationURL)

## Verifying Email Configuration

### Test Checklist:

1. **Request Password Reset**
   - Go to `/forgot-password`
   - Enter a registered email address
   - Submit the form

2. **Check Email Delivery**
   - Check inbox (should arrive within 1-2 minutes)
   - Check spam/junk folder
   - Check "Promotions" tab (Gmail)

3. **Verify Email Content**
   - Email should have "Reset Password" subject
   - Should contain a working link
   - Link should redirect to `/reset-password`

4. **Test Password Reset Flow**
   - Click the link in the email
   - Should redirect to reset password page
   - Enter new password
   - Should successfully reset and redirect to login

### Common Issues and Solutions:

#### "Email Sent!" but no email received

**Causes:**
- SMTP not configured in Supabase
- Invalid SMTP credentials
- Email provider rate limits exceeded
- Sender domain not verified

**Solutions:**
1. Check Supabase → Authentication → Settings → SMTP
2. Verify SMTP credentials with your provider
3. Check your provider's dashboard for delivery logs
4. Verify your sender domain/email

#### Emails going to spam

**Causes:**
- Domain not verified
- Missing SPF/DKIM records
- Using generic email addresses
- High bounce rate

**Solutions:**
1. Verify your domain with your email provider
2. Add SPF and DKIM records to DNS
3. Use a professional sender address (not gmail.com)
4. Warm up your domain by sending to valid addresses first

#### "Rate limit exceeded" error

**Causes:**
- Too many reset requests in short time
- Supabase built-in email limits (3/hour)

**Solutions:**
1. Switch to custom SMTP provider (higher limits)
2. Wait before retrying
3. Implement client-side rate limiting

#### Email link doesn't work

**Causes:**
- Redirect URL not whitelisted in Supabase
- Token expired (default: 1 hour)
- Link already used

**Solutions:**
1. Add redirect URLs to Supabase:
   - Go to Authentication → URL Configuration
   - Add: `http://localhost:3000/reset-password` (local)
   - Add: `https://yourdomain.com/reset-password` (production)
2. Request a new reset link
3. Check token expiry settings in Supabase

## Production Deployment Checklist

Before deploying to production:

- [ ] Custom SMTP configured (not using Supabase default)
- [ ] Sender domain verified
- [ ] SPF and DKIM records added to DNS
- [ ] Email templates customized with branding
- [ ] Redirect URLs whitelisted for production domain
- [ ] Test email delivery from production environment
- [ ] Monitor email delivery rates
- [ ] Set up email delivery notifications/alerts

## Monitoring Email Delivery

### In Your Email Provider Dashboard:

Most providers offer:
- Delivery statistics
- Bounce reports
- Spam complaint rates
- Open/click rates

### In Supabase:

- Go to Logs → Auth Logs
- Filter for "password_recovery" events
- Check for errors or failed attempts

### Recommended Monitoring:

1. **Set up alerts** for:
   - High bounce rates (>5%)
   - Spam complaints
   - Authentication failures

2. **Track metrics**:
   - Email delivery rate
   - Password reset completion rate
   - Time to email delivery

3. **User feedback**:
   - Add support email in app
   - Monitor user complaints about emails

## Security Considerations

1. **Rate Limiting**
   - Supabase has built-in rate limiting (1 email/minute per email)
   - Prevents abuse and spam

2. **Token Expiry**
   - Reset tokens expire after 1 hour (default)
   - Can't be reused after password is changed

3. **SMTP Credentials**
   - Store SMTP password securely
   - Use environment variables
   - Never commit credentials to git

4. **Sender Verification**
   - Only send from verified domains
   - Prevents spoofing and phishing

## Cost Considerations

### Free Tiers (Good for Small Apps):

| Provider | Free Tier | After Free Tier |
|----------|-----------|-----------------|
| SendGrid | 100 emails/day | $19.95/month (40K emails) |
| Mailgun | 5,000 emails/month | $35/month (50K emails) |
| Resend | 3,000 emails/month | $20/month (50K emails) |
| Amazon SES | 62,000 emails/month (if on EC2) | $0.10 per 1,000 emails |

### Cost Optimization:

1. **Start with free tier** for development/testing
2. **Monitor usage** to predict costs
3. **Implement email batching** if sending many emails
4. **Use transactional email only** (not marketing emails)
5. **Clean your email list** to avoid bounces

## Alternative Solutions

If setting up SMTP is too complex, consider:

1. **Magic Link Authentication**
   - Users click link to log in (no password)
   - No password reset needed
   - Requires email on every login

2. **OAuth/Social Login**
   - Login with Google, Facebook, etc.
   - No password to forget
   - Easier for users

3. **SMS-based Reset**
   - Use phone number for reset
   - Requires SMS provider (Twilio)
   - More reliable than email

## Support Resources

- **Supabase Docs**: https://supabase.com/docs/guides/auth/auth-smtp
- **SendGrid Setup**: https://sendgrid.com/docs/for-developers/sending-email/getting-started-smtp/
- **Mailgun Setup**: https://documentation.mailgun.com/en/latest/quickstart-sending.html
- **Community**: https://github.com/supabase/supabase/discussions

## Summary

To fix the "Email Sent but not received" issue:

1. **Immediate Fix**: Configure custom SMTP in Supabase Dashboard
2. **Long-term**: Set up proper email infrastructure with verified domain
3. **User Communication**: Update UI to warn users about potential email delays
4. **Monitoring**: Track email delivery and respond to issues quickly

The improved forgot-password page now includes a warning message to help users troubleshoot email delivery issues.
