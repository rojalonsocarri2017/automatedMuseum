# TFG Rodrigo Alonso (GENERACIÓN DE ESCENAS EN REALIDAD EXTENDIDA MEDIANTE VOZ)

Sistema modular basado en A-Frame para la generación y edición de escenas XR mediante lenguaje natural.

El proyecto está compuesto por un conjunto de componentes reutilizables que permiten construir experiencias inmersivas en realidad virtual y realidad aumentada usando voz o texto. El sistema integra reconocimiento de voz, procesamiento mediante modelos de lenguaje (LLM), renderizado dinámico de escenas 3D y persistencia de escenarios.

---

## Estructura del repositorio

### `/assets`

Contiene las imágenes y modelos 3D utilizados por el sistema.

---

### `/components`

Contiene los componentes principales del sistema desarrollados sobre A-Frame.

---


### `/Sprints`

Contiene los ejercicios previos realizados por cada Sprint.

---

### `/TFG`

Punto de entrada principal de la aplicación XR.

---

### `program.py`

Script encargado de generar automáticamente un fichero `index.html` a partir de una descripción de escena definida en YAML. Procesa la configuración de la habitación, luces, entorno, objetos y modelos 3D, generando dinámicamente una escena A-Frame completa. Es el script que se ejecuta automáticamente dentro del workflow de integración continua para generar y representar la escena XR que el usuario ha decidido persistir desde el sistema.


---

### `room.yaml`

Archivo de configuración de la escena. Define el estado completo de la habitación, incluyendo dimensiones, paredes, entorno, luces y objetos presentes en la escena mediante una estructura YAML.

---

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

## Más información
Puedes encontrar más información en la web del proyecto: https://rojalonsocarri2017.github.io/web-tfg/

## Licencia
Este proyecto es software gratuito y se distribuye bajo la licencia [MIT](LICENSE).
