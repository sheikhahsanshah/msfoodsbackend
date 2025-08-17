import dotenv from 'dotenv';
dotenv.config();
import nodemailer from 'nodemailer';

// Debugging: Log transporter config and sender info
console.log('SMTP2GO Transporter Config:', {
    host: process.env.EMAIL_HOST || '',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASSWORD || '',
    sender: process.env.EMAIL_FROM || ''
});

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || '',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER || '',
        pass: process.env.EMAIL_PASSWORD || '',
    },
    logger: true, // Enable Nodemailer logger
    debug: true   // Enable Nodemailer debug o  utput
});

console.log('Nodemailer transporter created. Sender:', process.env.EMAIL_FROM || 'msfoodscontact <msfoodscontact@gmail.com>');

export default transporter;