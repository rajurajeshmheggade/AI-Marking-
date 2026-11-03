export interface QuestionEntry {
  id: number;
  text: string;
  marks: number;
  rubrics: { text: string; score: number }[];
  subQuestions: SubQuestionEntry[];
}

export interface SubQuestionEntry {
  id: number;
  text: string;
  marks: number;
  rubrics: { text: string; score: number }[];
}

export function parseMarkdownToQuestions(mdText: string, subjectCode: string) {
  const questionsMap: Record<string, any[]> = {};
  
  // Split by ###
  const sections = mdText.split(/###\s+/);
  
  for (let i = 1; i < sections.length; i++) {
      const section = sections[i];
      const lines = section.split('\n');
      const titleLine = lines[0].trim();
      
      // Parse the question number and sub-label
      const labelMatch = titleLine.match(/^(\d+)(?:\([a-z0-9]+\)|\.)?\s*(.*)/i);
      if (!labelMatch) continue;
      
      const qNum = labelMatch[1];
      
      if (!questionsMap[qNum]) {
          questionsMap[qNum] = [];
      }
      
      let displayTitle = titleLine;
      
      const subqMatch = titleLine.match(/^\d+(\([a-z0-9]+\)(?:\([a-z0-9]+\))?)\s*(.*)/i);
      if (subqMatch) {
          // It's a sub-question like 1(a) -> becomes "(a) Describe..."
          displayTitle = subqMatch[1] + " " + subqMatch[2];
      } else {
          // It's a main question text like 2. Explain... -> becomes "Explain..."
          const mainMatch = titleLine.match(/^\d+\.\s*(.*)/i);
          if (mainMatch) {
               displayTitle = mainMatch[1];
          }
      }
      
      const marksMatch = titleLine.match(/\[(\d+)\s*marks?\]/i);
      let qMarks = marksMatch ? parseInt(marksMatch[1]) : 0;
      
      const maxMarksMatch = section.match(/\*\*Maximum\s*marks:\s*(\d+)\*\*/i);
      if (maxMarksMatch && qMarks === 0) {
          qMarks = parseInt(maxMarksMatch[1]);
      } else if (maxMarksMatch && qMarks !== parseInt(maxMarksMatch[1])) {
          qMarks = parseInt(maxMarksMatch[1]);
      }
      
      const textContent = displayTitle.replace(/\[\d+\s*marks?\]/i, '').trim();
      
      // Extract rubrics
      let rubricsSection = section;
      const markingMatch = section.match(/\*\*Marking:\*\*/i);
      const maxMarksIndexMatch = section.match(/\*\*Maximum\s*marks:/i);
      
      let markingIndex = markingMatch ? section.indexOf(markingMatch[0]) + markingMatch[0].length : -1;
      let maxMarksIndex = maxMarksIndexMatch ? section.indexOf(maxMarksIndexMatch[0]) : -1;
      
      if (markingIndex !== -1 && maxMarksIndex !== -1) {
           rubricsSection = section.substring(markingIndex, maxMarksIndex);
      } else if (markingIndex !== -1) {
           rubricsSection = section.substring(markingIndex);
      } else if (maxMarksIndex !== -1) {
           rubricsSection = section.substring(0, maxMarksIndex);
      } else {
           rubricsSection = ""; 
      }
      
      const rubrics: {text: string, score: number}[] = [];
      const rubricLines = rubricsSection.split(/\n(?:-|\d+\.)\s+/);
      
      if (rubricLines.length > 0) {
           for (let j = 0; j < rubricLines.length; j++) {
               let rText = rubricLines[j].trim().replace(/\n/g, ' ');
               if (rText && rText.length > 3 && !rText.toLowerCase().includes('maximum marks')) {
                  rubrics.push({ text: rText, score: 1 });
               }
           }
      }
      
      questionsMap[qNum].push({
          id: Math.floor(Math.random() * 1000000),
          text: textContent,
          marks: qMarks,
          rubrics: rubrics,
          subQuestions: [] 
      });
  }
  
  const result = [];
  for (const qNum of Object.keys(questionsMap).sort((a,b) => parseInt(a) - parseInt(b))) {
      const totalMarks = questionsMap[qNum].reduce((sum, q) => sum + q.marks, 0);
      
      result.push({
          "Subject Code": subjectCode,
          "Question Label": qNum,
          "Max Score": totalMarks,
          "Question JSON": JSON.stringify(questionsMap[qNum])
      });
  }
  
  return result;
}
