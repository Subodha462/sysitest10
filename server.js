const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const main = require('./sync-events.js'); // Import the main function from main.js

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/sysi', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Member Schema
const memberSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: { type: String, unique: true },
  jobTitle: String,
  companyName: String,
  inquiryPurpose: String,
  country: String,
  message: String,
  status: { type: String, enum: ['pending', 'approved'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

const Member = mongoose.model('Member', memberSchema);

// Define Subscriber Schema
const subscriberSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
  country: String,
  subscriptionTypes: [String],
  createdAt: { type: Date, default: Date.now }
});

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

// Nodemailer Configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'chiranandan54@gmail.com',
    pass: 'qjmv bwwg dsfq itvw'
  }
});

// Handle Member Form Submission
app.post('/api/join', async (req, res) => {
  try {
    const { firstName, lastName, email, jobTitle, companyName, inquiryPurpose, country, message } = req.body;

    // Check if email already exists
    const existingMember = await Member.findOne({ email });
    if (existingMember) {
      return res.status(400).json({ message: 'This email is already registered. Please use a different email.' });
    }

    const newMember = new Member({
      firstName,
      lastName,
      email,
      jobTitle,
      companyName,
      inquiryPurpose,
      country,
      message,
      status: 'pending'
    });

    await newMember.save();

    const approvalLink = `http://localhost:3000/api/approve?id=${newMember._id}`;
    const rejectionLink = `http://localhost:3000/api/reject?id=${newMember._id}`;

    const mailOptions = {
      from: 'chiranandan54@gmail.com',
      to: 'chiranandan54@gmail.com',
      subject: 'New Member Submission (Approval Needed)',
      text: `
        New Member Application

        ${firstName} ${lastName} has applied to join SYSI.
        Email: ${email}
        Company: ${companyName || 'N/A'} | Job: ${jobTitle || 'N/A'}
        Country: ${country}
        Purpose: ${inquiryPurpose}
        Message: ${message}

        Please review the application and choose an action:
        Accept: ${approvalLink}
        Reject: ${rejectionLink}
      `,
      html: `
        <h2>New Member Application</h2>
        <p><strong>${firstName} ${lastName}</strong> has applied to join SYSI.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Company:</strong> ${companyName || 'N/A'} | <strong>Job:</strong> ${jobTitle || 'N/A'}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>Purpose:</strong> ${inquiryPurpose}</p>
        <p><strong>Message:</strong> ${message}</p>
        <p>Please review the application and choose an action:</p>
        <div style="margin-top: 20px;">
          <a href="${approvalLink}" style="background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; margin-right: 10px; border-radius: 5px;">✅ Accept</a>
          <a href="${rejectionLink}" style="background-color: #f44336; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">❌ Reject</a>
        </div>
        <p style="margin-top: 20px;">If the buttons above do not work, use these links:</p>
        <p><a href="${approvalLink}">Accept</a> | <a href="${rejectionLink}">Reject</a></p>
      `
    };

    console.log('Sending email with the following content:');
    console.log('Subject:', mailOptions.subject);
    console.log('HTML:', mailOptions.html);

    await transporter.sendMail(mailOptions);
    console.log('Email sent successfully for member:', newMember._id);

    res.status(200).json({ message: 'Application submitted. Awaiting approval.' });
  } catch (error) {
    console.error('Error processing form:', error);
    res.status(500).json({ message: 'Error processing form' });
  }
});

// Handle Subscription Form Submission
app.post('/api/subscribe', async (req, res) => {
  const { firstName, lastName, email, country, subscriptionTypes } = req.body;
  console.log("Received subscription data:", req.body);

  try {
    const subscriber = new Subscriber({
      firstName,
      lastName,
      email,
      country,
      subscriptionTypes
    });
    await subscriber.save();
    console.log("Subscription data saved to MongoDB");

    const mailOptions = {
      from: 'chiranandan54@gmail.com',
      to: 'chiranandan54@gmail.com',
      subject: 'New Footer Subscription',
      html: `
        <h2>New Subscriber Details:</h2>
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Country:</strong> ${country}</p>
        <p><strong>Subscription Types:</strong> ${subscriptionTypes.join(', ')}</p>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log("Subscription email sent");
    res.status(200).send('Subscription successful!');
  } catch (error) {
    console.error("Error in POST /api/subscribe:", error);
    res.status(500).send('Server error. Try again later.');
  }
});

// Fetch All Members
app.get('/api/members', async (req, res) => {
  try {
    const members = await Member.find({ status: 'approved' });
    res.status(200).json(members);
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ message: 'Error fetching members' });
  }
});

// Approve a member
app.get('/api/approve', async (req, res) => {
  const { id } = req.query;
  try {
    const member = await Member.findByIdAndUpdate(id, { status: 'approved' }, { new: true });
    if (!member) return res.status(404).send('Member not found');

    // Send congratulatory email to member
    const congratsMailOptions = {
      from: 'chiranandan54@gmail.com',
      to: member.email,
      subject: 'Welcome to SYSI Research Foundation! 🎉',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9; border-radius: 10px;">
          <h2 style="color: #2c3e50; text-align: center;">Congratulations, ${member.firstName} ${member.lastName}!</h2>
          <p style="font-size: 16px; color: #34495e;">We are thrilled to welcome you as an official member of the SYSI Research Foundation! 🚀</p>
          <p style="font-size: 16px; color: #34495e;">Your passion for innovation and commitment to advancing cutting-edge technologies make you a valuable addition to our global community. Together, we’ll shape the future of technology and create impactful solutions.</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="http://localhost:3000/members" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-size: 16px;">Explore Member Benefits</a>
          </div>
          <p style="font-size: 16px; color: #34495e;">What’s next? Connect with our community, participate in events, and collaborate on groundbreaking projects. Stay tuned for updates and opportunities!</p>
          <p style="font-size: 16px; color: #34495e;">If you have any questions, feel free to reach out to us at <a href="https://mail.google.com/mail/?view=cm&fs=1&to=info@sysiresearch.org">info@sysiresearch.org</a>.</p>
          <p style="font-size: 16px; color: #34495e; text-align: center;">Welcome aboard, and let’s innovate together!</p>
          <p style="font-size: 14px; color: #7f8c8d; text-align: center; margin-top: 20px;">© 2025 SYSI Research Foundation. All rights reserved.</p>
        </div>
      `
    };

    await transporter.sendMail(congratsMailOptions);
    console.log('Congratulatory email sent to:', member.email);

    res.send(`✅ Member approved successfully. ${member.firstName} ${member.lastName} is now listed.`);
  } catch (error) {
    console.error('Error approving member:', error);
    res.status(500).send('Approval failed.');
  }
});

// Reject a member
app.get('/api/reject', async (req, res) => {
  const { id } = req.query;
  try {
    const member = await Member.findByIdAndDelete(id);
    if (!member) return res.status(404).send('Member not found');
    res.send(`✖ Member rejected and removed.`);
  } catch (error) {
    console.error('Error rejecting member:', error);
    res.status(500).send('Rejection failed.');
  }
});

// Start Server
app.listen(port, () => {
  main();
  console.log(`Server running on port ${port}`);
});
