// scannerempresa.js

// Asegúrate de que este script esté cargado DESPUÉS de la inclusión de opencv.js en el HTML

let cvReady = false;
let currentStream = null;
let currentDocType = "";
let usandoFrontal = false;

const filestackClient = filestack.init("A7II0wXa7TKix1YxL3cCRz");

function onOpenCvReady() {
  if (typeof cv !== 'undefined') {
    cvReady = true;
    console.log("OpenCV.js está listo y funcionando para Documentación Empresa!");
  } else {
    console.error("OpenCV.js no se cargó correctamente.");
  }
}

const scannedDocs = JSON.parse(localStorage.getItem("scannedDocsEmpresa") || "{}");

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
  const loadingMessage = document.getElementById("loading-message");
  const beforeCapture = document.getElementById("beforeCapture");
  const afterCapture = document.getElementById("afterCapture");

  const switchCameraBtn = document.createElement("button");
  switchCameraBtn.textContent = "🔁 Cambiar cámara";
  switchCameraBtn.className = "btn-capture btn-switch";
  switchCameraBtn.addEventListener("click", () => {
    usandoFrontal = !usandoFrontal;
    startCamera(usandoFrontal ? "user" : "environment");
  });
  beforeCapture.insertBefore(switchCameraBtn, captureBtn);

  const canvasOutput = document.getElementById("canvasOutput");
  const ctxOutput = canvasOutput.getContext("2d");

  scanButtons.forEach(button => {
    button.addEventListener("click", () => {
      currentDocType = button.getAttribute("data-doc");
      openScanner();
    });
  });

  function openScanner() {
    scannerContainer.style.display = "flex";
    preview.style.display = "none";
    loadingMessage.textContent = "Cargando video...";
    loadingMessage.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    camera.style.display = "block";
    capturedImage.src = '';
    startCamera(usandoFrontal ? "user" : "environment");
  }

  function startCamera(facingMode) {
    stopCamera();
    navigator.mediaDevices.getUserMedia({ video: { facingMode } })
      .then(stream => {
        currentStream = stream;
        camera.srcObject = stream;
        camera.onloadedmetadata = () => {
          camera.play();
          loadingMessage.style.display = "none";
        };
      })
      .catch(error => {
        console.error("Error al acceder a la cámara:", error);
        loadingMessage.textContent = "Error: No se pudo acceder a la cámara.";
        alert("No se pudo acceder a la cámara: " + error.message);
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
    captureBtn.disabled = false;
    switchCameraBtn.disabled = false;
  }

  captureBtn.addEventListener("click", () => {
    if (!cvReady) {
      alert("OpenCV.js aún no está listo. Por favor, espera un momento.");
      return;
    }

    camera.pause();
    camera.style.display = "none";
    loadingMessage.textContent = "Procesando imagen...";
    loadingMessage.style.display = "block";
    beforeCapture.style.display = "none";
    afterCapture.style.display = "none";

    const videoWidth = camera.videoWidth;
    const videoHeight = camera.videoHeight;

    const tempCanvas = document.createElement("canvas");
    const tempCtx = tempCanvas.getContext("2d");
    tempCanvas.width = videoWidth;
    tempCanvas.height = videoHeight;
    tempCtx.drawImage(camera, 0, 0, videoWidth, videoHeight);

    try {
      let src = cv.imread(tempCanvas);
      let dst = new cv.Mat();
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
      cv.GaussianBlur(dst, dst, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      let edges = new cv.Mat();
      cv.Canny(dst, edges, 75, 200);

      let contours = new cv.MatVector();
      let hierarchy = new cv.Mat();
      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

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
        let perimeter = cv.arcLength(maxContour, true);
        let approx = new cv.Mat();
        cv.approxPolyDP(maxContour, approx, 0.02 * perimeter, true);
        if (approx.rows === 4) {
          rect = approx;
        }
        approx.delete();
      }

      if (rect) {
        let points = [];
        for (let i = 0; i < rect.rows; ++i) {
          points.push({ x: rect.data32S[i * 2], y: rect.data32S[i * 2 + 1] });
        }
        points.sort((a, b) => a.y - b.y);
        let topLeft = points[0].x < points[1].x ? points[0] : points[1];
        let topRight = points[0].x > points[1].x ? points[0] : points[1];
        let bottomLeft = points[2].x < points[3].x ? points[2] : points[3];
        let bottomRight = points[2].x > points[3].x ? points[2] : points[3];
        let orderedPoints = [topLeft, topRight, bottomRight, bottomLeft];

        let widthA = Math.hypot(bottomRight.x - bottomLeft.x, bottomRight.y - bottomLeft.y);
        let widthB = Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y);
        let maxWidth = Math.max(widthA, widthB);

        let heightA = Math.hypot(topRight.x - bottomRight.x, topRight.y - bottomRight.y);
        let heightB = Math.hypot(topLeft.x - bottomLeft.x, topLeft.y - bottomLeft.y);
        let maxHeight = Math.max(heightA, heightB);

        let srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          topLeft.x, topLeft.y,
          topRight.x, topRight.y,
          bottomRight.x, bottomRight.y,
          bottomLeft.x, bottomLeft.y
        ]);

        let dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
          0, 0,
          maxWidth - 1, 0,
          maxWidth - 1, maxHeight - 1,
          0, maxHeight - 1
        ]);

        let M = cv.getPerspectiveTransform(srcTri, dstTri);
        let dsize = new cv.Size(maxWidth, maxHeight);
        let warped = new cv.Mat();
        cv.warpPerspective(src, warped, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

        // Mostrar imagen a color sin escala de grises ni umbral
        cv.imshow(canvasOutput, warped);

        warped.delete();
        srcTri.delete();
        dstTri.delete();
        M.delete();
      } else {
        console.warn("No se detectó un documento rectangular de 4 puntos. Mostrando imagen original.");
        cv.imshow(canvasOutput, src);
      }

      src.delete();
      dst.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      if (maxContour) maxContour.delete();
      if (rect) rect.delete();

      capturedImage.src = canvasOutput.toDataURL('image/jpeg', 0.9);
      loadingMessage.style.display = 'none';
      preview.style.display = 'block';
      beforeCapture.style.display = 'none';
      afterCapture.style.display = 'flex';

    } catch (e) {
      console.error("Error durante el procesamiento de OpenCV: ", e);
      loadingMessage.textContent = "Error al procesar la imagen. Intenta de nuevo.";
      loadingMessage.style.display = 'block';
      camera.style.display = 'block';
      camera.play();
      beforeCapture.style.display = 'flex';
      afterCapture.style.display = 'none';
    }
  });

  retakeBtn.addEventListener("click", () => {
    preview.style.display = "none";
    camera.style.display = "block";
    beforeCapture.style.display = "flex";
    afterCapture.style.display = "none";
    loadingMessage.style.display = 'none';
    camera.play();
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

      scannedDocs[currentDocType] = fileUrl;
      localStorage.setItem("scannedDocsEmpresa", JSON.stringify(scannedDocs));
      localStorage.setItem("origen", "documentacion-empresa.html");

      closeScanner();
    }).catch(err => {
      alert("Error al subir el archivo a Filestack: " + err.message);
      console.error(err);
    });
  });

  cancelScanBtn.addEventListener("click", () => {
    closeScanner();
  });
});
