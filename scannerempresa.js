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

  let currentStream = null;
  let currentDocType = "";
  let usandoFrontal = false;

  const filestackClient = filestack.init("A7II0wXa7TKix1YxL3cCRz");

  const switchCameraBtn = document.createElement("button");
  switchCameraBtn.textContent = "🔁 Cambiar cámara";
  switchCameraBtn.className = "btn-capture";
  switchCameraBtn.addEventListener("click", () => {
    usandoFrontal = !usandoFrontal;
    startCamera(usandoFrontal ? "user" : "environment");
  });
  beforeCapture.insertBefore(switchCameraBtn, captureBtn);

  // Cargar documentos previos si los hay
  const scannedDocs = JSON.parse(localStorage.getItem("scannedDocsEmpresa") || "{}");

  scanButtons.forEach(button => {
    button.addEventListener("click", () => {
      currentDocType = button.getAttribute("data-doc");
      openScanner();
    });
  });

  function openScanner() {
    scannerContainer.style.display = "flex";
    preview.style.display = "none";
    document.getElementById("loading-message").style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
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

    filestackClient.upload(file).then(result => {
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
      localStorage.setItem("scannedDocsEmpresa", JSON.stringify(scannedDocs));

      // Guardar origen actual
      localStorage.setItem("origen", "documentacion-empresa.html");

      closeScanner();
    }).catch(err => {
      alert("Error al subir el archivo a Filestack");
      console.error(err);
    });
  });

  cancelScanBtn.addEventListener("click", () => {
    closeScanner();
  });

  function closeScanner() {
    stopCamera();
    scannerContainer.style.display = "none";
    preview.style.display = "none";
    camera.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
  }
});
