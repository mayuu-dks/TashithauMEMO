// No 'ExtractedData' type import needed for plain JS, but for clarity:
// interface ExtractedData { numbers: number[]; sum: number; }

const convertFullWidthNumbersToHalfWidth = (text) => {
  return text.replace(/[０-９]/g, char => {
    return String.fromCharCode(char.charCodeAt(0) - 0xFEE0);
  });
};

const evaluateEquationsWithAnswers = (inputText) => {
  let text = inputText;
  const equationRegex = /(-?\d+(?:\.\d+)?)\s*([+\-×÷*/])\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?)/;
  while (true) {
    const match = text.match(equationRegex);
    if (!match) break;
    const fullExpression = match[0];
    const resultPart = match[4];
    text = text.replace(fullExpression, resultPart);
  }
  return text;
};

const evaluateMultiplicationDivision = (inputText) => {
  let text = inputText;
  const operationRegex = /(-?\d+(?:\.\d+)?)\s*(×|\*|÷|\/)\s*(-?\d+(?:\.\d+)?)/;
  while (true) {
    const match = text.match(operationRegex);
    if (!match) break;

    const expression = match[0];
    const num1Str = match[1];
    const operator = match[2];
    const num2Str = match[3];

    const num1 = parseFloat(num1Str);
    const num2 = parseFloat(num2Str);
    let resultValue;

    if (isNaN(num1) || isNaN(num2)) {
      text = text.replace(expression, '');
      continue;
    }

    if (operator === '×' || operator === '*') {
      resultValue = num1 * num2;
    } else if (operator === '÷' || operator === '/') {
      if (num2 !== 0) {
        resultValue = num1 / num2;
      } else {
        text = text.replace(expression, '');
        continue;
      }
    }

    if (resultValue !== undefined) {
      text = text.replace(expression, resultValue.toString());
    } else {
      text = text.replace(expression, '');
    }
  }
  return text;
};

const evaluateAdditionSubtraction = (inputText) => {
  let text = inputText;
  const operationRegex = /(-?\d+(?:\.\d+)?)\s*([+\-])\s*(-?\d+(?:\.\d+)?)/;
  while (true) {
    const match = text.match(operationRegex);
    if (!match) break;

    const expression = match[0];
    const num1Str = match[1];
    const operator = match[2];
    const num2Str = match[3];
    
    const num1 = parseFloat(num1Str);
    const num2 = parseFloat(num2Str);
    let resultValue;

    if (isNaN(num1) || isNaN(num2)) {
      text = text.replace(expression, '');
      continue;
    }

    if (operator === '+') {
      resultValue = num1 + num2;
    } else if (operator === '-') {
      resultValue = num1 - num2;
    }

    if (resultValue !== undefined) {
      text = text.replace(expression, resultValue.toString());
    } else {
      text = text.replace(expression, '');
    }
  }
  return text;
};

export const extractAndSumNumbers = (text) => {
  if (!text.trim()) {
    return { numbers: [], sum: 0 };
  }

  let mutableText = text;

  mutableText = convertFullWidthNumbersToHalfWidth(mutableText);
  mutableText = mutableText.replace(/\([^)]*\)|（[^）]*）/g, '');
  mutableText = mutableText.replace(/(\d+(?:\.\d+)?)\s*桁/g, '');
  
  let oldTextBeforeCommaRemoval;
  do {
    oldTextBeforeCommaRemoval = mutableText;
    mutableText = mutableText.replace(/(-?\b\d+),(\d{3}\b)/g, '$1$2');
  } while (mutableText !== oldTextBeforeCommaRemoval);

  mutableText = evaluateEquationsWithAnswers(mutableText);

  let textBeforeBracketProcessing;
  do {
    textBeforeBracketProcessing = mutableText;
    mutableText = mutableText.replace(/(?:\[([^\]]*)\]|［([^］]*)］)/g, (fullMatch, contentHalfWidth, contentFullWidth) => {
        let contentInside = contentHalfWidth || contentFullWidth;
        
        if (contentInside !== undefined && contentInside !== null) {
            let processedContentInside = evaluateMultiplicationDivision(contentInside);
            processedContentInside = evaluateAdditionSubtraction(processedContentInside);

            const innerNumbers = [];
            const innerNumberRegex = /-?\d+(\.\d+)?/g; 
            const contentMatches = processedContentInside.match(innerNumberRegex);

            if (contentMatches) {
                contentMatches.forEach(numStr => {
                    const num = parseFloat(numStr);
                    if (!isNaN(num)) innerNumbers.push(num);
                });
            }
            const innerSum = innerNumbers.reduce((acc, current) => acc + current, 0);
            return innerSum.toString();
        }
        return fullMatch; 
    });
  } while (mutableText !== textBeforeBracketProcessing);

  mutableText = evaluateMultiplicationDivision(mutableText);
  mutableText = evaluateAdditionSubtraction(mutableText);

  const allNumbers = [];
  const numberRegex = /-?\d+(\.\d+)?/g;
  const matches = mutableText.match(numberRegex);

  if (matches) {
    matches.forEach(numStr => {
      const num = parseFloat(numStr);
      if (!isNaN(num)) allNumbers.push(num);
    });
  }

  const sum = allNumbers.reduce((acc, current) => acc + current, 0);
  return { numbers: allNumbers, sum };
};
