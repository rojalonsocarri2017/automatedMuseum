const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  console.error("SpeechRecognition no está soportado en este navegador");
} else {

  const recognition = new SpeechRecognition();

  recognition.lang = 'es-ES';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onstart = () => {
    console.log("Micrófono activado");
  };

  recognition.onresult = (event) => {
    let textoFinal = "";

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        textoFinal += event.results[i][0].transcript;
      }
    }

    if (textoFinal) {
      console.log("Texto reconocido:", textoFinal);
    }
  };

  recognition.onerror = (event) => {
    console.error("Error:", event.error);
  };

  recognition.onend = () => {
    console.log("Micrófono desactivado");
  };

  document.getElementById("start").addEventListener("click", () => {
    recognition.start();
  });

  document.getElementById("stop").addEventListener("click", () => {
    recognition.stop();
  });
}
