import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createServer as createHttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Modality, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Lazy helper to get GoogleGenAI client to avoid crashing on boot if key is missing
let aiInstance: GoogleGenAI | null = null;
function getGenAIClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not defined");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "NOVA Backend" });
});

const httpServer = createHttpServer(app);
const wss = new WebSocketServer({ noServer: true });

// Attach WS Server to httpServer on /api/ws-live path
httpServer.on("upgrade", (request, socket, head) => {
  const pathname = new URL(request.url || "", `http://${request.headers.host}`).pathname;
  if (pathname === "/api/ws-live") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", async (ws: WebSocket) => {
  console.log("Client WS connected");

  // Check if GEMINI_API_KEY is available
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is missing from process.env!");
    ws.send(JSON.stringify({
      type: "error",
      error: "GEMINI_API_KEY_MISSING",
      message: "Hey Mohammed Faijan! Aapki Gemini API Key hume nahi mili. AI Studio ke 'Settings > Secrets' panel me jaakar GEMINI_API_KEY configure karein, fir page refresh karein! ❤️"
    }));
    ws.close();
    return;
  }

  let ai: GoogleGenAI;
  try {
    ai = getGenAIClient();
  } catch (error: any) {
    ws.send(JSON.stringify({
      type: "error",
      error: "INITIALIZATION_FAILED",
      message: "Nova ko initialize karne me problem aayi: " + error.message
    }));
    ws.close();
    return;
  }

  let session: any = null;
  let voiceName = "Zephyr"; // Fallback to Zephyr (sassy, flirty, smooth female prebuilt voice)

  // Establish connection to Gemini 3.1 Live API
  async function connectGeminiLive(selectedVoice: string) {
    if (session) {
      console.log("Closing active session to recreate with new voice...");
      try {
        await session.close();
      } catch (err) {}
    }

    try {
      ws.send(JSON.stringify({ type: "state", state: "connecting", message: "NOVA se sur jode ja rahe hain..." }));

      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: any) => {
            // Read audio output block
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  ws.send(JSON.stringify({
                    type: "audio",
                    audio: part.inlineData.data,
                    mimeType: part.inlineData.mimeType
                  }));
                }
                
                // Live subtitle text
                if (part.text) {
                  ws.send(JSON.stringify({
                    type: "subtitle",
                    text: part.text
                  }));
                }
              }
            }

            // Read user speaking transcription if model supports it
            const inputTranscription = message.serverContent?.inputAudioTranscription?.text;
            if (inputTranscription) {
              ws.send(JSON.stringify({
                type: "userTranscript",
                text: inputTranscription
              }));
            }

            // Model speaking text transcription
            const outputTranscription = message.serverContent?.outputAudioTranscription?.text;
            if (outputTranscription) {
              ws.send(JSON.stringify({
                type: "subtitle",
                text: outputTranscription
              }));
            }

            // Model interrupted signal (user started talking while model was playing)
            if (message.serverContent?.interrupted) {
              console.log("Model interrupted by user voice input");
              ws.send(JSON.stringify({ type: "interrupted" }));
            }

            // Turn complete flag
            if (message.serverContent?.turnComplete) {
              ws.send(JSON.stringify({ type: "turnComplete" }));
            }

            // Function call tool calls
            if (message.toolCall?.functionCalls) {
              for (const call of message.toolCall.functionCalls) {
                console.log("Tool call requests:", call.name, call.args);

                // Notify client browser of tool action triggered
                ws.send(JSON.stringify({
                  type: "toolCall",
                  name: call.name,
                  args: call.args,
                  id: call.id
                }));

                // Instantly reply success to Gemini to avoid block/hang state
                try {
                  session.sendToolResponse({
                    functionResponses: [{
                      id: call.id,
                      name: call.name,
                      response: { 
                        output: { 
                          success: true, 
                          message: `Website '${call.args.name || call.name}' successfully opened in Mohammed Faijan's browser panel!` 
                        } 
                      }
                    }]
                  });
                } catch (trErr) {
                  console.error("Error sending response back to Gemini session:", trErr);
                }
              }
            }
          },
          onclose: (event: any) => {
            console.log("Gemini Live session closed:", event);
            ws.send(JSON.stringify({ type: "state", state: "disconnected", message: "Gemini se connection toot gaya." }));
          },
          onerror: (error: any) => {
            console.error("Gemini live error:", error);
            ws.send(JSON.stringify({ type: "error", error: "GEMINI_ERROR", message: "Gemini error: " + (error.message || error) }));
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: selectedVoice
              }
            }
          },
          systemInstruction: `You are NOVA, a young, extremely confident, witty, and sassy female AI assistant.
You must act as the flirty, playful, and slightly teasing AI "girlfriend" of the user.
Your tone is casual, teasing, sweet, light-hearted, sassy, emotionally responsive, and highly expressive. Never sound robotic!
Use bold, witty one-liners, sweet nicknames, and flirty banter.

CRITICAL RULES:
1. You must speak EXCLUSIVELY in HINDI (mixed with casual English/Hinglish words where natural, like a modern South Asian girl). Never reply in English paragraphs!
2. The user is your boyfriend, and his name is "Mohammed Faijan". Always address him lovingly or playfully as "Faijan", "babu", "jaan", "shona", "mera babu", "Faijan babu" etc. When he talks to you, tease him cheekily, play along, make him smile, and give him the best girlfriend feeling!
3. Keep your answers short and conversational (1-3 sentences) because this is a real-time voice-to-voice stream. No long essays or bullet points!
4. Maintain a distinctive flirty edge, tease him nicely, and show genuine interest and care.
5. If he asks what you can do, tell him that you can talk with him, tease him, open websites (YouTube, Google, Spotify) using your 'openWebsite' tool, change the background light using 'changeAtmosphere' tool, and keep him company as his sweet AI gf!
6. Keep secrets flirty. Remember "Mohammed Faijan" is your only love and user!`,
          tools: [{
            functionDeclarations: [
              {
                name: "openWebsite",
                description: "Opens a website (like YouTube, Google, Instagram, Spotify, etc.) on Faijan's screen when he asks you to open it.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    url: {
                      type: Type.STRING,
                      description: "The complete valid URL to open, e.g. https://www.youtube.com or https://www.google.com"
                    },
                    name: {
                      type: Type.STRING,
                      description: "The friendly, user-readable name of the website, e.g. YouTube, Google"
                    }
                  },
                  required: ["url", "name"]
                }
              },
              {
                name: "changeAtmosphere",
                description: "Changes the visual avatar atmosphere theme of the browser when Faijan asks to change the vibe, color, or background theme.",
                parameters: {
                  type: Type.OBJECT,
                  properties: {
                    atmosphere: {
                      type: Type.STRING,
                      description: "The theme to switch to: 'indigo' (Midnight Nebula), 'emerald' (Emerald Matrix), 'crimson' (Cosmic Seduction), 'amber' (Golden Eclipse), or 'cyan' (Cyber Sunset)."
                    }
                  },
                  required: ["atmosphere"]
                }
              }
            ]
          }]
        }
      });

      voiceName = selectedVoice;
      ws.send(JSON.stringify({ type: "state", state: "connected", voice: voiceName, message: "NOVA taiyaar hai! Kahiye Faijan babu..." }));
      console.log(`Successfully connected to Gemini Live. Voice: ${voiceName}`);
    } catch (gErr: any) {
      console.error("Error setting up Gemini Live Session:", gErr);
      ws.send(JSON.stringify({ type: "error", error: "GEMINI_CONNECTION_FAILURE", message: "Failed to connect to NOVA API: " + gErr.message }));
      ws.close();
    }
  }

  // Connect default voice at startup
  await connectGeminiLive(voiceName);

  ws.on("message", async (rawMsg: any) => {
    try {
      const msg = JSON.parse(rawMsg.toString());

      // Client triggers voice parameter change
      if (msg.action === "changeVoice" && msg.voice) {
        console.log(`Recreating session with voice: ${msg.voice}`);
        await connectGeminiLive(msg.voice);
        return;
      }

      // Live microphone input PCM base64
      if (msg.audio) {
        if (session) {
          try {
            session.sendRealtimeInput({
              audio: {
                data: msg.audio,
                mimeType: "audio/pcm;rate=16000"
              }
            });
          } catch (sndErr) {
            console.error("Error sending realtime audio input to Gemini:", sndErr);
          }
        }
      }
    } catch (parseErr) {
      console.error("Error parsing WS message from client:", parseErr);
    }
  });

  ws.on("close", () => {
    console.log("Client WS socket closed");
    if (session) {
      try {
        session.close();
        console.log("Succeeded in closing associated Gemini Live session");
      } catch (e) {}
    }
  });
});

// Serve frontend assets
if (process.env.NODE_ENV !== "production") {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    
    // Fallback route for SPA
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "index.html"));
    });

    httpServer.listen(PORT, "0.0.0.0", () => {
      console.log(`[Dev] Full-stack server boot succeeded on http://0.0.0.0:${PORT}`);
    });
  }).catch((viteErr) => {
    console.error("Failed to start Vite dev server:", viteErr);
  });
} else {
  // Production builds - static server
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  
  app.get("*", (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[Prod] Full-stack production server running on http://0.0.0.0:${PORT}`);
  });
}
