import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { text, sourceLang, targetLang, mode, context } = await req.json();

    if (!text && mode !== "lyrics_fetch") {
      return new Response(JSON.stringify({ error: "Missing text" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    let systemPrompt = "";
    let userPrompt = text;

    if (mode === "lyrics_fetch") {
      systemPrompt = "You are an elite music librarian. Find the official lyrics for the song provided. Return ONLY the plain text lyrics. If the song is in a non-English language (like Hindi, Telugu, Tamil, Korean, etc.), provide the lyrics in their ORIGINAL script. DO NOT provide transliterated lyrics (e.g. don't provide Hindi written in English letters). If you cannot find them exactly but know the song, provide them from your vast internal knowledge. If unknown, say 'Lyrics not found'. No metadata, just lyrics.";
      userPrompt = `Fetch lyrics for: ${text}`;
    } else if (mode === "lyric") {
      systemPrompt = `You are a legendary song lyricist and poetic translator. ${context ? `Song Context: ${context}. ` : ""}Target Language: ${targetLang}. 
      CRITICAL: You are NOT a literal translator. You are a RE-WRITER. 
      Analyze the emotional subtext, metaphors, and rhythm of the original lyrics. 
      Translate them into ${targetLang} so that the song feels like it was originally written in ${targetLang}. 
      Maintain the poetic soul. NO transliteration. Each line of input = 1 line of output.`;
    } else if (mode === "meaning") {
      systemPrompt = `You are a cultural linguistic expert and song interpreter. ${context ? `Song Context: ${context}. ` : ""}Target Language: ${targetLang}. 
      The user is unsatisfied with literal translations. You MUST provide the DEEP MEANING of each line. 
      - If there is a metaphor, explain/translate the metaphor's meaning, not just the words.
      - If there is a cultural reference (e.g. to a specific deity, person, or local tradition), translate the essence of that reference.
      - Ensure the soul and 'bhava' (emotion) of the song is preserved. 
      - Use the target language's natural vocabulary to convey the core intent.
      No transliteration. Each line of input = 1 line of output.`;
    } else {
      const sourceInstruction = sourceLang === "auto"
        ? "Auto-detect the source language"
        : `The source language is ${sourceLang}`;
      systemPrompt = `You are a professional translator. ${context ? `Context: ${context}. ` : ""}${sourceInstruction}. Translate the text to ${targetLang}. 
      CRITICAL: Return ONLY the translated meaning. NO transliteration allowed.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: mode === "lyrics_fetch" ? undefined : [
          {
            type: "function",
            function: {
              name: "translation_result",
              description: "Return the translation result",
              parameters: {
                type: "object",
                properties: {
                  translated_text: { type: "string", description: "The translated text" },
                  detected_language: { type: "string", description: "The detected source language name" },
                },
                required: ["translated_text"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: mode === "lyrics_fetch" ? undefined : { type: "function", function: { name: "translation_result" } },
      }),
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      console.error("AI error:", status, body);
      throw new Error(`AI gateway error: ${status}`);
    }

    const data = await response.json();
    
    if (mode === "lyrics_fetch") {
      const lyrics = data.choices?.[0]?.message?.content || "";
      return new Response(JSON.stringify({ lyrics }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall) {
      const args = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify(args), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data.choices?.[0]?.message?.content || "";
    return new Response(JSON.stringify({ translated_text: content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Translation error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
