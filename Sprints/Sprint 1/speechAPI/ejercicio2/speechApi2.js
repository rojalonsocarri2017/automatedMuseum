
const OPENROUTER_API_KEY = "<OPENROUTER_API_KEY_AQUI>";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "arcee-ai/trinity-mini:free";


const conversation = [
  {
    role: "system",
    content: "Eres un asistente útil que responde SIEMPRE en español, de forma clara y concisa."
  }
];

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.error("SpeechRecognition no soportado en este navegador");
} else {

  const recognition = new SpeechRecognition();
  recognition.lang = "es-ES";
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    console.log("Escuchando...");
  };

  recognition.onresult = async (event) => {
    const textoReconocido = event.results[0][0].transcript;
    console.log("Texto reconocido:", textoReconocido);

    await enviarTextoAlLLM(textoReconocido);
  };

  recognition.onerror = (event) => {
    console.error("Error de reconocimiento:", event.error);
  };

  recognition.onend = () => {
    console.log("Fin de la escucha");
  };

  document.getElementById("start").onclick = () => recognition.start();
  document.getElementById("stop").onclick = () => recognition.stop();
}

async function enviarTextoAlLLM(textoUsuario) {

  conversation.push({
    role: "user",
    content: textoUsuario
  });

  const payload = {
    model: MODEL,
    messages: conversation,
    max_tokens: 2000
  };

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error OpenRouter:", errorText);
      return;
    }

    const data = await response.json();
    const respuestaLLM = data.choices[0].message.content;

    console.log("Respuesta del LLM:");
    console.log(respuestaLLM);

    conversation.push({
      role: "assistant",
      content: respuestaLLM
    });

  } catch (error) {
    console.error("Error de red:", error);
  }
}

