import { Request, Response } from 'express';
import Analysis from '../models/analysis.model';
import User from '../models/user.model';
import multer from 'multer';
// import pdfParse from 'pdf-parse'; // Removed in favor of local require
import { groq } from '@ai-sdk/groq';
import { generateObject } from 'ai';
import { z } from 'zod';
import fs from 'fs';

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      cb(null, true);
    } else {
      cb(null, false);
    }
  },
});

export const uploadMiddleware = upload.single('cvFile');

// Schema for AI Output
const analysisSchema = z.object({
  score: z.number().describe('Score from 0 to 100 based on match with job description'),
  status: z.enum(['excellent', 'good', 'needs-improvement']).describe('Overall status of the CV'),
  jobTitle: z.string().describe('Extracted or inferred job title from CV or JD'),
  company: z.string().describe('Extracted company/industry name from JD if available, or "Target Company"'),
  jobDescriptionSummary: z.string().describe('A concise summary of the job description in Bahasa Indonesia, maximum 3 sentences.'),
  strengths: z.array(z.string()).describe('List of strong points in the CV in Bahasa Indonesia'),
  weaknesses: z.array(z.string()).describe('List of weak points or missing skills in Bahasa Indonesia'),
  suggestions: z.array(z.string()).describe('Actionable suggestions for improvement in Bahasa Indonesia'),
  keywords: z.object({
    found: z.array(z.string()).describe('Keywords from JD found in CV'),
    missing: z.array(z.string()).describe('Important keywords from JD missing in CV'),
  }),
  sections: z.object({
    format: z.object({ score: z.number(), feedback: z.string().describe('Feedback in Bahasa Indonesia') }),
    content: z.object({ score: z.number(), feedback: z.string().describe('Feedback in Bahasa Indonesia') }),
    keywords: z.object({ score: z.number(), feedback: z.string().describe('Feedback in Bahasa Indonesia') }),
    experience: z.object({ score: z.number(), feedback: z.string().describe('Feedback in Bahasa Indonesia') }),
  }),
});

export const analyzeCv = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ message: 'No file uploaded' });
      return;
    }

    const jobDescription = req.body.jobDescription;
    const targetCompany = req.body.targetCompany || 'Target Company';

    if (!jobDescription) {
      res.status(400).json({ message: 'Job description is required' });
      return;
    }

    // Check user quota
    const user = await User.findByPk((req as any).user.id);
    if (user?.role === 'free') {
      // Check if quota reset is needed (simple monthly check)
      const now = new Date();
      if (now.getMonth() !== user.lastQuotaReset.getMonth() || 
          now.getFullYear() !== user.lastQuotaReset.getFullYear()) {
         // Reset quota
         user.analysisQuota = 5;
         user.lastQuotaReset = now;
         await user.save();
      }

      if (user.analysisQuota <= 0) {
        res.status(403).json({ message: 'Free quota exceeded. Please upgrade to Pro.' });
        return;
      }
    }

    let cvText = '';
    
    if (req.file.mimetype === 'application/pdf') {
       try {
         // Using the specific PDFParse class from the library
         const { PDFParse } = require('pdf-parse');
         // Convert Buffer to Uint8Array as required by the library
         const uint8Array = new Uint8Array(req.file.buffer);
         const parser = new PDFParse(uint8Array);
         const data = await parser.getText();
         cvText = data.text;
       } catch (error) {
         console.error('PDF Parse Error:', error);
         res.status(500).json({ message: 'Failed to parse PDF file' });
         return;
       }
    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
       try {
         const mammoth = require('mammoth');
         const result = await mammoth.extractRawText({ buffer: req.file.buffer });
         cvText = result.value;
       } catch (error) {
         console.error('DOCX Parse Error:', error);
         res.status(500).json({ message: 'Failed to parse DOCX file' });
         return;
       }
    } else {
         res.status(400).json({ message: 'Unsupported file format. Please upload PDF or DOCX.' });
         return;
    }

    if (!cvText || cvText.trim().length < 50) {
      res.status(400).json({ message: 'Could not extract sufficient text from the file.' });
      return;
    }

    // Call Groq AI
    const result = await generateObject({
      model: groq('moonshotai/kimi-k2-instruct-0905'), // Using Qwen model as requested
      schema: analysisSchema,
      prompt: `
        You are an expert ATS (Applicant Tracking System) and Resume Coach.
        Analyze the following CV against the provided Job Description.

        IMPORTANT: Provide ALL output in **Bahasa Indonesia** (Indonesian language).

        JOB DESCRIPTION:
        ${jobDescription}

        TARGET COMPANY:
        ${targetCompany}

        CV CONTENT:
        ${cvText}

        Provide a strict JSON output matching the schema.
        For 'jobDescriptionSummary', create a concise summary of the provided Job Description in Bahasa Indonesia, maximum 3 sentences.
        If 'company' is not explicitly mentioned in the Job Description, use "${targetCompany}".
        Be critical but constructive.
      `,
    });

    const aiData = result.object;

    // Save to Database
    const analysis = await Analysis.create({
      userId: (req as any).user.id, // Assumes auth middleware populates user
      jobTitle: aiData.jobTitle || 'Unknown Position',
      company: targetCompany !== 'Target Company' ? targetCompany : (aiData.company || 'Unknown Company'),
      jobDescription: jobDescription,
      cvText: cvText,
      score: aiData.score,
      status: aiData.status,
      analysisResult: aiData,
    });

    // Decrement quota if free user
    if (user?.role === 'free') {
      user.analysisQuota -= 1;
      await user.save();
    }

    res.status(201).json({
      message: 'Analysis completed successfully',
      data: analysis,
    });

  } catch (error) {
    console.error('Analysis Error:', error);
    res.status(500).json({ message: 'Internal server error during analysis' });
  }
};

export const getAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const analysis = await Analysis.findOne({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' });
      return;
    }

    res.json({ data: analysis });
  } catch (error) {
    console.error('Get Analysis Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

export const getHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const history = await Analysis.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'jobTitle', 'company', 'score', 'status', 'createdAt'], // Minimal fields for list
    });

    res.json({ data: history });
  } catch (error) {
    console.error('Get History Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const summarySchema = z.object({
  options: z.array(z.string()).length(3).describe('Three different professional summary options in Bahasa Indonesia'),
});

export const generateSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const analysis = await Analysis.findOne({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' });
      return;
    }

    // Check if summary options already exist and not regenerating
    const { regenerate } = req.body;
    const storedSummary = analysis.get('summaryOptions');
    if (storedSummary && !regenerate) {
      const parsedSummary = typeof storedSummary === 'string' 
        ? JSON.parse(storedSummary) 
        : storedSummary;
      res.json({ data: parsedSummary });
      return;
    }

    // Call Groq AI
    const result = await generateObject({
      model: groq('moonshotai/kimi-k2-instruct-0905'),
      schema: summarySchema,
      prompt: `
        You are an expert Resume Writer and Career Coach.
        Based on the User's CV content and the Target Job Description, generate 3 distinct Professional Summary options for their CV.

        Option 1: Professional (Safe, standard corporate tone, polished)
        Option 2: Achievement Based (Focus on metrics, results, and action verbs)
        Option 3: Creative (Showcasing personality, passion, and potential)

        IMPORTANT: Provide ALL output in **Bahasa Indonesia**.
        Each summary should be approx 3-5 sentences long.

        JOB DESCRIPTION:
        ${analysis.jobDescription}

        TARGET COMPANY:
        ${analysis.company}

        CV CONTENT:
        ${analysis.cvText}

        Provide a strict JSON output matching the schema.
      `,
    });

    const summaryData = result.object;

    // Save to DB
    analysis.set('summaryOptions', summaryData);
    await analysis.save();

    res.json({ data: summaryData });

  } catch (error) {
    console.error('Generate Summary Error:', error);
    res.status(500).json({ message: 'Internal server error during summary generation' });
  }
};

const coverLetterSchema = z.object({
  coverLetter: z.string().describe('The complete cover letter text in Bahasa Indonesia'),
  tips: z.object({
    strengths: z.array(z.string()).describe('List of 4 strong points about this specific cover letter based on the CV and JD'),
  }),
});

export const generateCoverLetter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const analysis = await Analysis.findOne({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' });
      return;
    }

    // Check if cover letter already exists and not regenerating
    const { regenerate } = req.body;
    const storedCoverLetter = analysis.get('coverLetter');
    const storedTips = analysis.get('coverLetterTips');
    
    if (storedCoverLetter && !regenerate) {
       const parsedTips = typeof storedTips === 'string'
         ? JSON.parse(storedTips)
         : storedTips;

       res.json({ 
         data: { 
           coverLetter: storedCoverLetter,
           tips: parsedTips 
         } 
       });
       return;
    }

    // Call Groq AI
    const result = await generateObject({
      model: groq('moonshotai/kimi-k2-instruct-0905'),
      schema: coverLetterSchema,
      prompt: `
        You are an expert Career Coach and Professional Writer.
        Write a persuasive Cover Letter for the User based on their CV and the Job Description.

        The tone should be: Professional, Confident, and Enthusiastic.
        
        IMPORTANT: 
        1. Provide ALL output in **Bahasa Indonesia**.
        2. Customize the letter specifically for the company: "${analysis.company}".
        3. Highlight key achievements from the CV that match the Job Description.
        4. Keep it concise (approx 300-400 words).
        5. Also provide 4 "Strength Points" explaining why this cover letter is effective (e.g., "Mentioned specific company value", "Quantified achievement in paragraph 2").

        JOB DESCRIPTION:
        ${analysis.jobDescription}

        CV CONTENT:
        ${analysis.cvText}

        TARGET COMPANY:
        ${analysis.company}
      `,
    });

    const coverLetterData = result.object;

    // Save to DB
    analysis.set('coverLetter', coverLetterData.coverLetter);
    analysis.set('coverLetterTips', coverLetterData.tips);
    await analysis.save();

    res.json({ data: coverLetterData });
  } catch (error) {
    console.error('Generate Cover Letter Error:', error);
    res.status(500).json({ message: 'Internal server error during cover letter generation' });
  }
};

export const updateCoverLetter = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;
    const { coverLetter } = req.body;

    const analysis = await Analysis.findOne({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' });
      return;
    }

    analysis.set('coverLetter', coverLetter);
    await analysis.save();

    res.json({ message: 'Cover letter updated successfully', data: { coverLetter } });
  } catch (error) {
    console.error('Update Cover Letter Error:', error);
    res.status(500).json({ message: 'Internal server error during cover letter update' });
  }
};

const interviewSchema = z.object({
  questions: z.array(z.object({
    id: z.string(),
    category: z.enum(['behavioral', 'technical', 'company']),
    question: z.string(),
    goodAnswer: z.object({
      structure: z.string().describe('Recommended structure for the answer'),
      keyPoints: z.array(z.string()).describe('Key points to cover'),
      example: z.string().describe('A strong example answer')
    }),
    badAnswer: z.object({
      examples: z.array(z.string()).describe('Examples of weak or bad answers'),
      whyBad: z.array(z.string()).describe('Reasons why these answers are bad')
    })
  })).length(10)
});

export const generateInterview = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    const analysis = await Analysis.findOne({
      where: { id, userId },
    });

    if (!analysis) {
      res.status(404).json({ message: 'Analysis not found' });
      return;
    }

    // Check if interview questions already exist
    const { regenerate } = req.body;
    const storedQuestions = analysis.get('interviewQuestions');
    if (storedQuestions && !regenerate) {
      const parsedQuestions = typeof storedQuestions === 'string'
        ? JSON.parse(storedQuestions)
        : storedQuestions;
      res.json({ data: parsedQuestions });
      return;
    }

    // Call Groq AI
    const result = await generateObject({
      model: groq('moonshotai/kimi-k2-instruct-0905'),
      schema: interviewSchema,
      prompt: `
        You are an expert Interview Coach.
        Generate 10 Interview Questions for a candidate applying for:
        Job Title: ${analysis.jobTitle}
        Company: ${analysis.company}

        Distribution:
        - Behavioral: 4 questions (STAR method focus, category 'behavioral')
        - Technical: 4 questions (Based on skills in JD/CV, category 'technical')
        - About Company: 2 questions (Research focused, category 'company')

        IMPORTANT:
        - Provide ALL output in **Bahasa Indonesia**.
        - Questions should be specific to the role and company.
        - valid categories are: 'behavioral', 'technical', 'company'.
        
        For each question, provide:
        1. A "Good Answer" guide including structure, key points, and a specific example.
        2. "Bad Answer" examples and explanation of why they are bad.

        JOB DESCRIPTION:
        ${analysis.jobDescription}

        CV CONTENT:
        ${analysis.cvText}
      `,
    });

    const interviewData = result.object;

    // Add unique IDs if not present (though schema asks for it)
    interviewData.questions = interviewData.questions.map((q: any, i: number) => ({
      ...q,
      id: `q-${i + 1}`
    }));

    // Save to DB
    analysis.set('interviewQuestions', interviewData);
    await analysis.save();

    res.json({ data: interviewData });

  } catch (error) {
    console.error('Generate Interview Error:', error);
    res.status(500).json({ message: 'Internal server error during interview generation' });
  }
};
