export async function onRequestPost(context) {
  try {
    const token = context.env.HF_TOKEN;

    if (!token) {
      return json({
        error: "HF_TOKEN is missing from Cloudflare."
      }, 500);
    }

    const body = await context.request.json();

    const question = String(body.question || "").trim();
    const image = body.image || null;
    const subject = body.subject || "Auto-detect";
    const explanation = body.explanation || "Step-by-step";

    if (!question && !image) {
      return json({
        error: "Please enter a question or upload a screenshot."
      }, 400);
    }

    const prompt = `
You are StudyPack, an educational AI tutor.

Solve the student's question and teach them how to solve it.

Subject: ${subject}
Explanation style: ${explanation}

IMPORTANT:
- Read the screenshot carefully if an image is provided.
- Do not invent information that is not visible.
- Show the important mathematical or logical workings.
- Explain each step in simple student-friendly language.
- Give the final answer clearly.
- If the question is unclear, say what is unclear.
- Give a confidence score from 0 to 100.

Return ONLY valid JSON using this structure:

{
  "question": "question you detected",
  "confidence": 0,
  "steps": [
    {
      "title": "Step 1 title",
      "explanation": "What happens in this step and why"
    }
  ],
  "answer": "final answer"
}
`;

    const messageContent = [];

    messageContent.push({
      type: "text",
      text: prompt
    });

    if (question) {
      messageContent.push({
        type: "text",
        text: "\nStudent's typed question:\n" + question
      });
    }

    if (image) {
      messageContent.push({
        type: "image_url",
        image_url: {
          url: image
        }
      });
    }

    const response = await fetch(
      "https://router.huggingface.co/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemma-4-31B-it:cerebras",
          messages: [
            {
              role: "user",
              content: messageContent
            }
          ],
          temperature: 0.2,
          max_tokens: 1600
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json({
        error: data?.error || "Analysis temporarily unavailable
studypack couldn't complete the analysis. Please try again in a moment."
      }, response.status);
    }

    const output = data?.choices?.[0]?.message?.content;

    if (!output) {
      return json({
        error: "Hugging Face returned an empty response."
      }, 502);
    }

    let result;

    try {
      result = JSON.parse(output);
    } catch {
      const cleaned = output
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      try {
        result = JSON.parse(cleaned);
      } catch {
        result = {
          question: question || "Question detected from screenshot",
          confidence: 60,
          steps: [
            {
              title: "AI explanation",
              explanation: output
            }
          ],
          answer: output
        };
      }
    }

    return json({
      question: result.question || question,
      confidence: Number(result.confidence) || 0,
      steps: Array.isArray(result.steps) ? result.steps : [],
      answer: result.answer || "No final answer was returned."
    });

  } catch (error) {
    return json({
      error: error?.message || "Unexpected server error."
    }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
      }
