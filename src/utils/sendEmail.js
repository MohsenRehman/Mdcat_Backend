import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const isSecure = port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: port,
    secure: isSecure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: {
      // Allow self-signed or unauthorized certificates which are common in private SMTP hosts
      rejectUnauthorized: false
    }
  });

  const message = {
    from: `${process.env.FROM_NAME || 'MDCAT Platform'} <${process.env.FROM_EMAIL || process.env.EMAIL_USER || 'rehmanmohsen31@gmail.com'}>`,
    to: options.email,
    subject: options.subject,
    html: options.html,
  };

  const info = await transporter.sendMail(message);

  console.log('Message sent: %s', info.messageId);
};

export default sendEmail;
