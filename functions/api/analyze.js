export async function onRequestPost(context) {
  try {
    const HF_TOKEN = context.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return json({ error: "HF_TOKEN is not configured." }, 500);
    }

    const body = await context.request.json();

    const question = body.question || "";
    const image = body.image || null;
    const subject = body.subject || "Auto-detect";
    const explanation = body.explanation || "Step-by-step";

    if (!question && !image) {
      return json({ error: "Please provide a question or image." }, 400);
    }

    const content = [];

    content.push({
      type: "text",
      text: `
You are StudyPack, an educational AI assistant.

Help the student understand the question rather than only giving an answer.

Subject: ${subject}
Explanation style: ${explanation}

Return ONLY valid JSON in this exact structure:

{
  "question": "the detected or provided question",
  "confidence": 0,
  "steps": [
    {
      "title": "short step title",
      "explanation": "clear explanation of this step"
    }
  ],
  "answer": "final answer"
}

Rules:
- Show the reasoning/workings clearly.
- Use simple student-friendly language.
- If the image is unclear, say what is unclear instead of inventing information.
- Confidence must be a number from 0 to 100.
- Do not include markdown code fences.
      `
    });

    if (question) {
      content.push({
        type: "text",
        text: "Student question:\n" + question
      });
    }

    if (image) {
      content.push({
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
          "Authorization": `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemma-4-31B-it:cerebras",
          messages: [
            {
              role: "user",
              content
            }
          ],
          temperature: 0.2,
          max_tokens: 1200
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return json({
        error: data?.error || "Hugging Face request failed."
      }, response.status);
    }

    const output = data?.choices?.[0]?.message?.content;

    if (!output) {
      return json({ error: "The AI returned no answer." }, 502);
    }

    let result;

    try {
      result = JSON.parse(output);
    } catch {
      result = {
        question: question || "Question detected from image",
        confidence: 70,
        steps: [
          {
            title: "AI explanation",
            explanation: output
          }
        ],
        answer: output
      };
    }

    return json(result, 200);

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
