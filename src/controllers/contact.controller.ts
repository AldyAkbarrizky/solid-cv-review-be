import { Request, Response } from 'express';
import nodemailer from 'nodemailer';
import { z } from 'zod';


const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const contactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  category: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  message: z.string().min(10, "Message must be at least 10 characters"),
});

export const sendContactEmail = async (req: Request, res: Response): Promise<void> => {
  try {
    const validatedData = contactSchema.parse(req.body);

    const mailOptions = {
      from: "Solid CV System",
      replyTo: validatedData.email,
      to: 'AldyAkbarrizky18@gmail.com',
      subject: `[Contact Form] ${validatedData.category ? `[${validatedData.category}] ` : ''}${validatedData.subject}`,
      text: `
        Name: ${validatedData.name}
        Email: ${validatedData.email}
        Category: ${validatedData.category || 'General'}
        Subject: ${validatedData.subject}
        
        Message:
        ${validatedData.message}
      `,
      html: `
        <h3>New Contact Form Submission</h3>
        <p><strong>Name:</strong> ${validatedData.name}</p>
        <p><strong>Email:</strong> ${validatedData.email}</p>
        <p><strong>Category:</strong> ${validatedData.category || 'General'}</p>
        <p><strong>Subject:</strong> ${validatedData.subject}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${validatedData.message}</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ message: 'Email sent successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Invalid data', errors: error.issues });
    } else {
      console.error('Contact Email Error:', error);
      res.status(500).json({ message: 'Failed to send email' });
    }
  }
};
