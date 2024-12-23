const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const path = require('path');

const app = express();

// Configure multer to use memory storage instead of disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route handler
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to extract questions from text
function extractQuestions(text) {
    // Split text into lines and identify questions
    const lines = text.split('\n');
    const questions = lines.filter(line => 
        line.trim().length > 0 && 
        (line.trim().endsWith('?') || /^\d+\.|^[a-zA-Z]\)/.test(line.trim()))
    );
    return questions;
}

// Function to remove duplicates keeping first occurrence
function removeDuplicates(questions) {
    const seen = new Set();
    return questions.filter(question => {
        const normalized = question.trim().toLowerCase();
        if (!seen.has(normalized)) {
            seen.add(normalized);
            return true;
        }
        return false;
    });
}

app.post('/upload', upload.array('docFiles', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        let allText = '';
        
        // Process each file and combine their content
        for (const file of req.files) {
            // Check file extension
            const fileExt = path.extname(file.originalname).toLowerCase();
            if (fileExt !== '.doc' && fileExt !== '.docx') {
                throw new Error(`Invalid file type: ${fileExt}. Only .doc and .docx files are supported.`);
            }

            console.log(`Processing file: ${file.originalname}`);
            try {
                const result = await mammoth.extractRawText({
                    buffer: file.buffer // Use buffer instead of file path
                });
                console.log(`Successfully extracted text from: ${file.originalname}`);
                allText += result.value + '\n\n';
            } catch (fileError) {
                console.error(`Error processing file ${file.originalname}:`, fileError);
                throw new Error(`Failed to process file ${file.originalname}: ${fileError.message}`);
            }
        }

        // Extract questions and remove duplicates
        const questions = extractQuestions(allText);
        const uniqueQuestions = removeDuplicates(questions);

        console.log(`Processed ${req.files.length} files`);
        console.log(`Found ${questions.length} questions, ${uniqueQuestions.length} unique`);

        // Send back the processed questions
        res.json({
            originalCount: questions.length,
            uniqueCount: uniqueQuestions.length,
            questions: uniqueQuestions,
            filesProcessed: req.files.length
        });

    } catch (error) {
        console.error('Error processing files:', error);
        res.status(500).json({ 
            error: 'Error processing files',
            details: error.message 
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
