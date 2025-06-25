// scanner.js

// Asegúrate de que este script esté cargado DESPUÉS de la inclusión de opencv.js en el HTML
// y DESPUÉS de documentacion-general.html o documentacion-empresa.html

let cvReady = false; // Variable global para verificar si OpenCV.js está listo
let currentStream = null; // Para guardar la referencia al stream de la cámara
let currentDocType = ""; // Para el tipo de documento actual
let usingBackCamera = true; // Controla qué cámara se está usando (true = trasera, false = frontal)

// Inicializa Filestack con tu API Key. ¡Asegúrate de que esta clave sea la correcta!
const filestackClient = filestack.init("A7II0wXa7TKix1YxL3cCRz");

// *** Función de callback para cuando OpenCV.js esté listo ***
function onOpenCvReady() {
  if (typeof cv !== 'undefined') {
    cvReady = true;
    console.log("OpenCV.js está listo y funcionando!");
    // Aquí puedes habilitar elementos de la UI que dependan de OpenCV si es necesario.
  } else {
    console.error("OpenCV.js no se cargó correctamente.");
  }
}

// *** Cargar datos guardados del localStorage (mantenemos tu lógica existente) ***
const scannedDocs = JSON.parse(localStorage.getItem("scannedDocsGeneral") || "{}");
let trabajadorNombre = localStorage.getItem("trabajadorNombre") || "";

document.addEventListener("DOMContentLoaded", () => {
  // *** Elementos del DOM ***
  const scanButtons = document.querySelectorAll(".scan-btn");
  const scannerContainer = document.getElementById("scanner-container");
  const camera = document.getElementById("camera");
  const captureBtn = document.getElementById("captureBtn");
  const retakeBtn = document.getElementById("retakeBtn");
  const acceptBtn = document.getElementById("acceptBtn");
  const cancelScanBtn = document.getElementById("cancelScanBtn");
  const capturedImage = document.getElementById("capturedImage");
  const preview = document.getElementById("preview");
  const loadingMessage = document.getElementById("loading-message"); // Asegúrate de tener este elemento en tu HTML

  const beforeCapture = document.getElementById("beforeCapture");
  const afterCapture = document.getElementById("afterCapture");

  // Nuevo elemento Canvas para el procesamiento de OpenCV.js (debe estar en el HTML, oculto)
  const canvasOutput = document.getElementById("canvasOutput"); 
  const ctxOutput = canvasOutput.getContext("2d"); // Contexto 2D para dibujar en el canvas de salida

  // Botón para cambiar de cámara (ya lo tienes, solo me aseguro de referenciarlo)
  const switchCameraBtn = document.createElement("button");
  switchCameraBtn.textContent = "🔁 Cambiar cámara";
  switchCameraBtn.className = "btn-capture btn-switch"; // Añadimos una clase para estilos si es necesario
  beforeCapture.insertBefore(switchCameraBtn, captureBtn); // Insertar antes del botón de captura

  // *** Event Listeners para los botones de escaneo ***
  scanButtons.forEach(button => {
    button.addEventListener("click", () => {
      currentDocType = button.getAttribute("data-doc");
      openScanner();
    });
  });

  // *** Funciones de control de la cámara y el escáner ***
  function openScanner() {
    scannerContainer.style.display = "flex"; // Usar 'flex' si tu CSS lo define así para centrar
    preview.style.display = "none";
    loadingMessage.textContent = "Cargando video..."; // Mensaje inicial
    loadingMessage.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    camera.style.display = "block";
    capturedImage.src = ''; // Limpiar cualquier imagen previa

    startCamera(usingBackCamera ? "environment" : "user");
  }

  function startCamera(facingMode) {
    stopCamera(); // Detener stream anterior si existe
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        currentStream = stream;
        camera.srcObject = stream;
        // Esperar a que el video cargue los metadatos para obtener dimensiones correctas
        camera.onloadedmetadata = () => {
            camera.play();
            loadingMessage.style.display = "none"; // Ocultar mensaje de carga
        };
      })
      .catch(error => {
        console.error("Error al acceder a la cámara:", error);
        loadingMessage.textContent = "Error: No se pudo acceder a la cámara. Asegúrate de que los permisos están activados.";
        alert("No se pudo acceder a la cámara: " + error.message); // Usar error.message para un mensaje más amigable
        // Opcional: Deshabilitar botones de captura si no hay cámara
        captureBtn.disabled = true;
        switchCameraBtn.disabled = true;
      });
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      camera.srcObject = null;
    }
  }

  function closeScanner() {
    stopCamera();
    scannerContainer.style.display = "none";
    preview.style.display = "none";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    camera.style.display = "block";
    // Restablecer el estado del botón de captura si se deshabilitó
    captureBtn.disabled = false;
    switchCameraBtn.disabled = false;
  }

  // *** Event Listener para Capturar Foto (con OpenCV.js) ***
  captureBtn.addEventListener("click", () => {
    if (!cvReady) {
      alert("OpenCV.js aún no está listo. Por favor, espera un momento.");
      console.warn("Intento de captura antes de que OpenCV.js esté listo.");
      return;
    }

    // Pausar el video y mostrar mensaje de procesamiento
    camera.pause();
    camera.style.display = "none";
    loadingMessage.textContent = "Procesando imagen...";
    loadingMessage.style.display = "block";
    beforeCapture.style.display = "none"; // Ocultar botones de captura
    afterCapture.style.display = "none"; // Ocultar botones de vista previa

    const videoWidth = camera.videoWidth;
    const videoHeight = camera.videoHeight;

    // Crear un canvas temporal para dibujar el fotograma del video
    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = videoWidth;
    tempCanvas.height = videoHeight;
    tempCtx.drawImage(camera, 0, 0, videoWidth, videoHeight);

    // *** PROCESAMIENTO DE IMAGEN CON OpenCV.js ***
    try {
      let src = cv.imread(tempCanvas); // Cargar la imagen del canvas en una Mat de OpenCV
      let dst = new cv.Mat(); // Matriz de destino para el resultado

      // 1. Convertir a escala de grises (útil para la detección de contornos)
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

      // 2. Aplicar un desenfoque Gaussiano para reducir el ruido
      cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);

      // 3. Detección de bordes con Canny
      let edges = new cv.Mat();
      cv.Canny(dst, edges, 75, 200); // Umbrales ajustables

      // 4. Encontrar contornos
      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

      // 5. Encontrar el contorno más grande (que probablemente es el documento)
      let maxArea = 0;
      let maxContour = null;
      for (let i = 0; i < contours.size(); ++i) {
        let contour = contours.get(i);
        let area = cv.contourArea(contour);
        if (area > maxArea) {
          maxArea = area;
          maxContour = contour;
        }
      }

      let rect = null;
      if (maxContour) {
        // Aproximar el contorno a un polígono con menos vértices
        let perimeter = cv.arcLength(maxContour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(maxContour, approx, 0.02 * perimeter, true);

        // Si el contorno aproximado tiene 4 vértices, es un rectángulo (documento)
        if (approx.rows === 4) {
          rect = approx;
        }
        approx.delete();
      }

      if (rect) {
        // Reordenar los puntos para que estén en el orden: top-left, top-right, bottom-right, bottom-left
        let points = [];
        for (let i = 0; i < rect.rows; ++i) {
          points.push({ x: rect.data32S[i * 2], y: rect.data32S[i * 2 + 1] });
        }
        points.sort((a, b) => a.y - b.y); // Ordenar por Y

        let tl, tr, bl, br;
        if (points[0].x < points[1].x) {
          tl = points[0]; tr = points[1];
        } else {
          tl = points[1]; tr = points[0];
        }

        if (points[2].x < points[3].x) {
          bl = points[2]; br = points[3];
        } else {
          bl = points[3]; br = points[2];
        }

        // Calcular ancho y alto del documento transformado
        let widthA = Math.sqrt(Math.pow(br.x - bl.x, 2) + Math.pow(br.y - bl.y, 2));
        let widthB = Math.sqrt(Math.pow(tr.x - tl.x, 2) + Math.pow(tr.y - tl.y, 2));
        let maxWidth = Math.max(widthA, widthB);

        let heightA = Math.sqrt(Math.pow(tr.x - br.x, 2) + Math.pow(tr.y - br.y, 2));
        let heightB = Math.sqrt(Math.pow(tl.x - bl.x, 2) + Math.pow(tl.y - bl.y, 2));
        let maxHeight = Math.max(heightA, heightB);

        // Puntos de origen (del contorno detectado)
        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);

        // Puntos de destino (un rectángulo perfecto con el tamaño calculado)
        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, maxWidth - 1, 0, maxWidth - 1, maxHeight - 1, 0, maxHeight - 1]);

        let M = cv.getPerspectiveTransform(srcTri, dstTri); // Matriz de transformación de perspectiva

        let dsize = new cv.Size(maxWidth, maxHeight);
        let warped = new cv.Mat();
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // Opcional: Convertir a escala de grises y aplicar un umbral adaptativo para un aspecto de escáner en blanco y negro
        let finalProcessed = new cv.Mat();
        cv.cvtColor(warped, finalProcessed, cv.COLOR_RGBA2GRAY);
        cv.adaptiveThreshold(finalProcessed, finalProcessed, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

        cv.imshow(canvasOutput, finalProcessed); // Mostrar la imagen procesada en el canvas de salida
        warped.delete();
        finalProcessed.delete();
        srcTri.delete();
        dstTri.delete();
        M.delete();

      } else {
        // Si no se encontró un rectángulo de 4 puntos, solo se convierte a escala de grises y se muestra
        console.warn("No se detectó un documento rectangular de 4 puntos. Mostrando imagen en escala de grises.");
        cv.imshow(canvasOutput, dst); // Muestra la Mat en escala de grises
      }

      // Liberar las Mats de memoria
      src.delete();
      dst.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      if (maxContour) maxContour.delete();
      if (rect) rect.delete();

      // Convertir el canvas de salida a una URL de imagen para mostrarla en el <img>
      capturedImage.src = canvasOutput.toDataURL('image/jpeg', 0.9); // Calidad de JPEG 90%

      // Mostrar la vista previa y los botones de acción
      loadingMessage.style.display = 'none'; // Ocultar mensaje de procesamiento
      preview.style.display = 'block';
      beforeCapture.style.display = 'none';
      afterCapture.style.display = 'flex';

    } catch (e) {
      console.error("Error durante el procesamiento de OpenCV: ", e);
      loadingMessage.textContent = "Error al procesar la imagen. Intenta de nuevo.";
      loadingMessage.style.display = 'block'; // Asegurarse de que el mensaje de error sea visible

      // Si hay un error de OpenCV, vuelve a mostrar la cámara y los botones de captura
      camera.style.display = 'block';
      camera.play();
      beforeCapture.style.display = 'flex';
      afterCapture.style.display = 'none';
    }
  });

  // *** Event Listener para Re-tomar Foto ***
  retakeBtn.addEventListener("click", () => {
    preview.style.display = "none";
    camera.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    loadingMessage.style.display = 'none'; // Ocultar mensaje de carga/procesamiento
    camera.play(); // Reiniciar el video de la cámara
  });

  // *** Event Listener para Aceptar Foto (ahora usa la imagen procesada) ***
  acceptBtn.addEventListener("click", async () => {
    // La imagen en `capturedImage.src` ya es la que fue procesada por OpenCV.js
    const file = await fetch(capturedImage.src)
      .then(res => res.blob())
      .then(blob => new File([blob], `${currentDocType}.jpg`, { type: "image/jpeg" }));

    // Tu lógica de Filestack y localStorage existente
    filestackClient.upload(file).then(async result => {
      const fileUrl = result.url;

      const img = document.createElement("img");
      img.src = fileUrl;
      img.alt = `Documento: ${currentDocType}`;
      img.classList.add("final-preview-img");

      const docItem = document.querySelector(`.document-item[data-doc="${currentDocType}"]`);
      if (docItem) {
        const previewContainer = docItem.querySelector(".doc-preview");
        const statusIcon = docItem.querySelector(".status-icon");

        previewContainer.innerHTML = "";
        previewContainer.appendChild(img);
        statusIcon.textContent = "✅";
      }

      scannedDocs[currentDocType] = fileUrl;
      localStorage.setItem("scannedDocsGeneral", JSON.stringify(scannedDocs));
      localStorage.setItem("origen", "documentacion-general.html");

      if (currentDocType.toLowerCase().includes("imss")) { // Cambié de "ine" a "imss" para el ejemplo
         // Aquí podrías querer usar Tesseract.js localmente en lugar de Filestack OCR si la calidad es suficiente
         // const imssNumber = await realizarOCRConTesseract(capturedImage.src);
         // if (imssNumber) {
         //   trabajadorNombre = imssNumber; // O el campo específico para IMSS
         //   localStorage.setItem("trabajadorNombre", trabajadorNombre);
         // }

        // Si sigues usando Filestack OCR, asegúrate de que la API key sea visible para el frontend
        // y que el `handle` de la imagen procesada se pueda pasar correctamente.
        // La URL de Filestack para OCR es `https://cdn.filestackcontent.com/ocr/[handle]`
        const nombreOImss = await realizarOCR(result.handle); // Reutilizar tu función existente
        if (nombreOImss) {
             trabajadorNombre = nombreOImss; // Esto dependerá de qué quieras extraer
             localStorage.setItem("trabajadorNombre", trabajadorNombre);
        }
      }

      closeScanner();
    }).catch(err => {
      alert("Error al subir el archivo a Filestack: " + err.message);
      console.error(err);
    });
  });

  // *** Event Listener para Cancelar Escaneo ***
  cancelScanBtn.addEventListener("click", () => {
    closeScanner();
  });

  // *** Event Listener para Cambiar Cámara ***
  switchCameraBtn.addEventListener("click", () => {
    usingBackCamera = !usingBackCamera;
    startCamera(usingBackCamera ? "environment" : "user");
  });

  // *** Tu función OCR existente con Filestack (asegúrate de que la API Key sea válida y esté en el frontend si es necesario) ***
  async function realizarOCR(handle) {
    try {
      // Nota: Tu API Key de Filestack para OCR parece ser diferente a la de inicialización.
      // Asegúrate de usar la correcta y que sea accesible desde el frontend.
      const response = await fetch(`https://cdn.filestackcontent.com/ocr/${handle}`, {
        headers: {
          // 'Filestack-API-Key': 'A31q0qbd1TYip6E7pozsLz' // Tu clave para upload
          'Filestack-API-Key': 'A31q0qbd1TYip6E7pozsLz' // Asegúrate que esta es la correcta para OCR
        }
      });

      if (!response.ok) {
          throw new Error(`Error HTTP: ${response.status} - ${await response.text()}`);
      }

      const data = await response.json();
      const texto = data.text || "";
      console.log("Texto OCR crudo:", texto); // Para depuración

      // Ajusta tu lógica de expresión regular para lo que necesites extraer
      // Si buscas "Número de IMSS", la regex podría ser diferente.
      // Por ejemplo, para un número de IMSS que suele ser numérico:
      // const imssEncontrado = texto.match(/\b\d{10,11}\b/); // Busca 10 u 11 dígitos
      // if (imssEncontrado) {
      //   console.log("Número IMSS detectado:", imssEncontrado[0].trim());
      //   return imssEncontrado[0].trim();
      // }

      // Tu regex actual para "NOMBRE"
      const nombreEncontrado = texto.match(/(?<=NOMBRE\s?)[A-ZÁÉÍÓÚÑ ]{10,}/i);
      if (nombreEncontrado) {
        console.log("Nombre detectado:", nombreEncontrado[0].trim());
        return nombreEncontrado[0].trim();
      }

      return null;
    } catch (error) {
      console.error("Error en OCR:", error);
      alert("Error al realizar OCR: " + error.message);
      return null;
    }
  }

  // Opcional: Función para OCR local con Tesseract.js (si prefieres no usar Filestack para esto)
  // async function realizarOCRConTesseract(imageUrl) {
  //   try {
  //     const { data: { text } } = await Tesseract.recognize(
  //       imageUrl,
  //       'spa', // Idioma español
  //       { logger: m => console.log(m) } // Para ver el progreso en consola
  //     );
  //     console.log("Texto OCR Tesseract:", text);
  //     // Aquí puedes aplicar tu regex para extraer el nombre o IMSS
  //     const nombreEncontrado = text.match(/(?<=NOMBRE\s?)[A-ZÁÉÍÓÚÑ ]{10,}/i);
  //     if (nombreEncontrado) {
  //       return nombreEncontrado[0].trim();
  //     }
  //     return null;
  //   } catch (error) {
  //     console.error("Error en OCR con Tesseract:", error);
  //     return null;
  //   }
  // }

}); // Fin de DOMContentLoaded
