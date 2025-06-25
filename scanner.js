document.addEventListener("DOMContentLoaded", () => {
  const scanButtons = document.querySelectorAll(".scan-btn");
  const scannerContainer = document.getElementById("scanner-container");
  const camera = document.getElementById("camera");
  const captureBtn = document.getElementById("captureBtn");
  const retakeBtn = document.getElementById("retakeBtn");
  const acceptBtn = document.getElementById("acceptBtn");
  const cancelScanBtn = document.getElementById("cancelScanBtn");
  const capturedImage = document.getElementById("capturedImage");
  const preview = document.getElementById("preview");

  const beforeCapture = document.getElementById("beforeCapture");
  const afterCapture = document.getElementById("afterCapture");

  const switchCameraBtn = document.createElement("button");
  switchCameraBtn.textContent = "🔁 Cambiar cámara";
  switchCameraBtn.className = "btn-capture";
  beforeCapture.insertBefore(switchCameraBtn, captureBtn);

  let currentStream = null;
  let currentDocType = "";
  let usingBackCamera = true;

  const filestackClient = filestack.init("A7II0wXa7TKix1YxL3cCRz");

  // Cargar datos guardados
  const scannedDocs = JSON.parse(localStorage.getItem("scannedDocsGeneral") || "{}");
  let trabajadorNombre = localStorage.getItem("trabajadorNombre") || "";

  scanButtons.forEach(button => {
    button.addEventListener("click", () => {
      currentDocType = button.getAttribute("data-doc");
      openScanner();
    });
  });

  function openScanner() {
    scannerContainer.style.display = "block";
    preview.style.display = "none";
    document.getElementById("loading-message").style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    camera.style.display = "block";
    startCamera(usingBackCamera ? "environment" : "user");
  }

  function startCamera(facingMode) {
    stopCamera();
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        currentStream = stream;
        camera.srcObject = stream;
        document.getElementById("loading-message").style.display = "none";
      })
      .catch(error => {
        alert("No se pudo acceder a la cámara: " + error);
      });
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(track => track.stop());
      camera.srcObject = null;
    }
  }

  captureBtn.addEventListener("click", () => {
    const canvas = document.createElement("canvas");
    canvas.width = camera.videoWidth;
    canvas.height = camera.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg");

    capturedImage.src = dataUrl;
    preview.style.display = "block";
    camera.style.display = "none";
    beforeCapture.style.display = "none";
    afterCapture.style.display = "flex";
  });

  retakeBtn.addEventListener("click", () => {
    preview.style.display = "none";
    camera.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
  });

  acceptBtn.addEventListener("click", async () => {
    const file = await fetch(capturedImage.src)
      .then(res => res.blob())
      .then(blob => new File([blob], `${currentDocType}.jpg`, { type: "image/jpeg" }));

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

      // Guardar en localStorage
      scannedDocs[currentDocType] = fileUrl;
      localStorage.setItem("scannedDocsGeneral", JSON.stringify(scannedDocs));

      // Guardar origen actual
      localStorage.setItem("origen", "documentacion-general.html");

      // Si es INE, ejecutar OCR y guardar nombre
      if (currentDocType.toLowerCase().includes("ine")) {
        const nombre = await realizarOCR(result.handle);
        if (nombre) {
          trabajadorNombre = nombre;
          localStorage.setItem("trabajadorNombre", trabajadorNombre);
        }
      }

      closeScanner();
    }).catch(err => {
      alert("Error al subir el archivo a Filestack");
      console.error(err);
    });
  });

  cancelScanBtn.addEventListener("click", () => {
    closeScanner();
  });

  switchCameraBtn.addEventListener("click", () => {
    usingBackCamera = !usingBackCamera;
    startCamera(usingBackCamera ? "environment" : "user");
  });

  function closeScanner() {
    stopCamera();
    scannerContainer.style.display = "none";
    preview.style.display = "none";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    camera.style.display = "block";
  }

  async function realizarOCR(handle) {
    try {
      const response = await fetch(`https://cdn.filestackcontent.com/ocr/${handle}`, {
        headers: {
          'Filestack-API-Key': 'A31q0qbd1TYip6E7pozsLz'
        }
      });

      const data = await response.json();
      const texto = data.text || "";

      const nombreEncontrado = texto.match(/(?<=NOMBRE\s?)[A-ZÁÉÍÓÚÑ ]{10,}/i);
      if (nombreEncontrado) {
        console.log("Nombre detectado:", nombreEncontrado[0].trim());
        return nombreEncontrado[0].trim();
      }

      return null;
    } catch (error) {
      console.error("Error en OCR:", error);
      return null;
    }
  }
});
