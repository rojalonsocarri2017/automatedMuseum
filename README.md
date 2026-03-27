# TFG Rodrigo Alonso (GENERACIÓN DE ESCENAS EN REALIDAD EXTENDIDA MEDIANTE VOZ)

## Requisitos de Configuración
Antes de ejecutar el proyecto, es necesario configurar varias API KEYS.

### Openrouter API (LLM)
En el archivo `index.html` dentro del componente `llm-client` tienes que añadir la API KEY de Openrouter.
```html
openrouterApikey: API_KEY_OPENROUTER
```
Puedes obtenerla en: https://openrouter.ai/

### Token GitHub

En el archivo `index.html` dentro del componente `push-to-github` tienes que añadir el token de GitHub y la configuración del repositorio a la que quieres enviar el YAML generado de la escena.
```html
  owner: OWNER_GITHUB; 
  repo: REPO_GITHUB; 
  filePath: PATH_GITHUB_OUTPUT_YAML; 
  branch: BRANCH_GITHUB; 
  token: TOKEN_GITHUB; 
```

Puedes obtenerla en: https://github.com/settings/tokens

### Groq API (Reconocimiento de voz)
En el archivo `voice-input-groq.js` tienes que añadir la API KEY de Groq.
```javascript
  apiKey: { default: "<YOUR_GROQ_API_KEY>" }
```
Puedes obtenerla en: https://console.groq.com/home

### Elige el reconocimiento de voz
En el archivo `index.html` puedes elegir 3 distintos tipos de reconocimiento de voz `speechapi`, `groq`, `vosk` dentro del componente `voice-input`.
```html
  <a-entity voice-input="engine: vosk"></a-entity>
```

## Uso en VR
1. Pulsa el botón **"VR"** para activar el modo realidad virtual.
2. 
   - Mantén pulsado el botón trasero del mando derecho para hablar
   - Suéltalo para generar la escena
3. Interactúa con la escena moviéndote con el joystick y creando escenarios con la voz

## DEMO
https://rojalonsocarri2017.github.io/automatedMuseum/TFG/
