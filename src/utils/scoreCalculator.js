/**
 * Calculates the score of a test based on provided user responses and actual MCQs
 * @param {Array} userResponses - Array of objects { mcqId, selectedOptionIndex }
 * @param {Array} actualMcqs - Array of MCQ documents from DB
 * @returns {Object} { correctAnswers, wrongAnswers, unattempted, totalMarks, score, percentage }
 */
export const calculateScore = (userResponses, actualMcqs) => {
  let correctAnswers = 0;
  let wrongAnswers = 0;
  let unattempted = 0;
  
  // We'll map responses by MCQ ID for easier lookup
  const responsesMap = {};
  userResponses.forEach(r => {
    responsesMap[r.mcq.toString()] = r.selectedOptionIndex;
  });

  const responses = [];

  actualMcqs.forEach(mcq => {
    const mcqId = mcq._id.toString();
    const selectedOptionIndex = responsesMap[mcqId] !== undefined ? responsesMap[mcqId] : -1;
    
    let isCorrect = false;

    if (selectedOptionIndex === -1) {
      unattempted++;
    } else if (selectedOptionIndex === mcq.correctOptionIndex) {
      correctAnswers++;
      isCorrect = true;
    } else {
      wrongAnswers++;
    }

    responses.push({
      mcq: mcqId,
      selectedOptionIndex,
      isCorrect
    });
  });

  const totalQuestions = actualMcqs.length;
  // Let's assume each question is 1 mark and no negative marking for now
  const MARKS_PER_QUESTION = 1;
  const NEGATIVE_MARKS = 0; 
  
  const score = (correctAnswers * MARKS_PER_QUESTION) - (wrongAnswers * NEGATIVE_MARKS);
  const totalMarks = totalQuestions * MARKS_PER_QUESTION;
  const percentage = totalMarks > 0 ? (score / totalMarks) * 100 : 0;

  return {
    responses,
    correctAnswers,
    wrongAnswers,
    unattempted,
    totalMarks,
    score,
    percentage: parseFloat(percentage.toFixed(2))
  };
};
