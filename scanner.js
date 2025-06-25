document.addEventListener("DOMContentLoaded", () => {
  /* ---------- ELEMENTOS DEL DOM ---------- */
  const scanButtons      = document.querySelectorAll(".scan-btn");
  const scannerContainer = document.getElementById("scanner-container");
  const camera           = document.getElementById("camera");
  const captureBtn       = document.getElementById("captureBtn");
  const retakeBtn        = document.getElementById("retakeBtn");
  const acceptBtn        = document.getElementById("acceptBtn");
  const cancelScanBtn    = document.getElementById("cancelScanBtn");
  const capturedImage    = document.getElementById("capturedImage");
  const preview          = document.getElementById("preview");

  const beforeCapture    = document.getElementById("beforeCapture");
  const afterCapture     = document.getElementById("afterCapture");

  /* ---------- VARIABLES ---------- */
  let currentStream   = null;
  let currentDocType  = "";
  let usandoFrontal   = false;

  const filestackClient = filestack.init("A7II0wXa7TKix1YxL3cCRz");

  /* ---------- BOTÓN CAMBIAR CÁMARA ---------- */
  const switchCameraBtn = document.createElement("button");
  switchCameraBtn.textContent = "🔁 Cambiar cámara";
  switchCameraBtn.className   = "btn-capture";
  switchCameraBtn.addEventListener("click", () => {
    usandoFrontal = !usandoFrontal;
    startCamera(usandoFrontal ? "user" : "environment");
  });
  beforeCapture.insertBefore(switchCameraBtn, captureBtn);

  /* ---------- CARGAR DOCUMENTOS YA GUARDADOS ---------- */
  const scannedDocs = JSON.parse(localStorage.getItem("scannedDocsGeneral") || "{}");

  /* ---------- ASIGNAR CLIC A CADA BOTÓN DE DOCUMENTO ---------- */
  scanButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      currentDocType = btn.getAttribute("data-doc");
      openScanner();
    });
  });

  /* ---------- FUNCIONES PRINCIPALES ---------- */

  function openScanner() {
    scannerContainer.style.display = "block";
    preview.style.display          = "none";
    document.getElementById("loading-message").style.display = "block";
    beforeCapture.style.display    = "flex";
    afterCapture.style.display     = "none";
    camera.style.display           = "block";
    startCamera(usandoFrontal ? "user" : "environment");
  }

  function startCamera(facingMode) {
    stopCamera();
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        currentStream = stream;
        camera.srcObject = stream;
        document.getElementById("loading-message").style.display = "none";
      })
      .catch(err => alert("No se pudo acceder a la cámara: " + err));
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      camera.srcObject = null;
    }
  }

  /* ---------- FUNCION PARA ACTUALIZAR TEXTO DEL TIPO DOCUMENTO ---------- */
  function actualizarTipoDocDetectado(texto) {
    const docItem = document.querySelector(`.document-item[data-doc="${currentDocType}"]`);
    if (!docItem) return;
    const tipoDocElem = docItem.querySelector(".tipo-doc-detectado");
    if (!tipoDocElem) return;
    tipoDocElem.textContent = texto;
  }

  /* ---------- CAPTURAR FOTO ---------- */
  captureBtn.addEventListener("click", () => {

    /* --- Canvas original --- */
    const canvas = document.createElement("canvas");
    canvas.width  = camera.videoWidth;
    canvas.height = camera.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(camera, 0, 0, canvas.width, canvas.height);
    const aspectRatio = canvas.width / canvas.height;

    /* --- Detectar tamaño por relación de aspecto --- */
    const tipoDetectado = detectDocType(aspectRatio);
    actualizarTipoDocDetectado(`Tamaño estimado: ${tipoDetectado}`);

    /* --- Canvas procesado (efecto escáner) --- */
    const scanCanvas = document.createElement("canvas");
    scanCanvas.width  = canvas.width;
    scanCanvas.height = canvas.height;
    const sctx = scanCanvas.getContext("2d");
    sctx.filter = "grayscale(100%) contrast(140%) brightness(115%)";
    sctx.drawImage(canvas, 0, 0);

    /* --- DataURL resultante con efecto escáner --- */
    const processedUrl = scanCanvas.toDataURL("image/jpeg", 0.9);

    capturedImage.src = processedUrl;            // mostramos la mejorada
    preview.style.display          = "block";
    camera.style.display           = "none";
    beforeCapture.style.display    = "none";
    afterCapture.style.display     = "flex";
  });

  /* ---------- BOTÓN “VOLVER A TOMAR” ---------- */
  retakeBtn.addEventListener("click", () => {
    preview.style.display       = "none";
    camera.style.display        = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display  = "none";
  });

  /* ---------- BOTÓN “ACEPTAR” ---------- */
  acceptBtn.addEventListener("click", async () => {
    /* El `capturedImage.src` ya contiene la versión procesada */
    const file = await fetch(capturedImage.src)
      .then(r => r.blob())
      .then(b => new File([b], `${currentDocType}.jpg`, { type: "image/jpeg" }));

    filestackClient.upload(file).then(async res => {
      const fileUrl = res.url;

      /* Pre-visualización */
      const img = document.createElement("img");
      img.src = fileUrl;
      img.alt = `Documento: ${currentDocType}`;
      img.classList.add("final-preview-img");

      const docItem = document.querySelector(`.document-item[data-doc="${currentDocType}"]`);
      if (docItem) {
        docItem.querySelector(".doc-preview").innerHTML = "";
        docItem.querySelector(".doc-preview").appendChild(img);
        docItem.querySelector(".status-icon").textContent = "✅";
      }

      /* Guardar y marcar origen */
      scannedDocs[currentDocType] = fileUrl;
      localStorage.setItem("scannedDocsGeneral", JSON.stringify(scannedDocs));
      localStorage.setItem("origen", "documentacion-general.html");

      closeScanner();
    }).catch(err => {
      alert("Error al subir el archivo a Filestack");
      console.error(err);
    });
  });

  /* ---------- BOTÓN “CANCELAR” ---------- */
  cancelScanBtn.addEventListener("click", closeScanner);

  function closeScanner() {
    stopCamera();
    scannerContainer.style.display = "none";
    preview.style.display          = "none";
    camera.style.display           = "block";
    beforeCapture.style.display    = "flex";
    afterCapture.style.display     = "none";
  }

  /* ---------- UTILIDADES ---------- */
  function detectDocType(r) { // r = aspectRatio
    if (r >= 0.74 && r <= 0.81)     return "Carta (8.5×11″)";
    if (r >= 0.60 && r < 0.74)      return "Oficio / Legal (8.5×13″)";
    if (r >= 1.50 && r <= 1.70)     return "Credencial (INE/ID)";
    return "Tamaño no estándar";
  }
});
