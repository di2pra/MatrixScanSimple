const isViewShowingAlternateContent = {};
const viewContents = {};
let view;

resetResults();

document.addEventListener('deviceready', () => {

  // Calculate the width of a quadrilateral (barcode location) based on it's corners.
  Scandit.Quadrilateral.prototype.width = function () {
    return Math.max(this.topRight.x - this.topLeft.x, this.bottomRight.x - this.bottomLeft.x);
  }

  // Create data capture context using your license key.
  const context = Scandit.DataCaptureContext.forLicenseKey('----- LICENCE KEY -------');

  // Use the world-facing (back) camera and set it as the frame source of the context. The camera is off by
  // default and must be turned on to start streaming frames to the data capture context for recognition.
  const camera = Scandit.Camera.default;
  camera.preferredResolution = Scandit.VideoResolution.FullHD;
  context.setFrameSource(camera);

  // The barcode tracking process is configured through barcode tracking settings
  // which are then applied to the barcode tracking instance that manages barcode tracking.
  const settings = new Scandit.BarcodeTrackingSettings();

  // The settings instance initially has all types of barcodes (symbologies) disabled. For the purpose of this
  // sample we enable a very generous set of symbologies. In your own app ensure that you only enable the
  // symbologies that your app requires as every additional enabled symbology has an impact on processing times.
  settings.enableSymbologies([
    Scandit.Symbology.EAN13UPCA,
    Scandit.Symbology.EAN8,
    Scandit.Symbology.UPCE,
    Scandit.Symbology.Code39,
    Scandit.Symbology.Code128,
  ]);

  // Create new barcode tracking mode with the settings from above.
  const barcodeTracking = Scandit.BarcodeTracking.forContext(context, settings);

  // Register a listener to get informed whenever a new barcode is tracked.
  barcodeTracking.addListener({
    didUpdateSession: (barcodeTracking, session) => {

      Object.values(session.trackedBarcodes).forEach(trackedBarcode => {
        window.results[trackedBarcode.barcode.data] = trackedBarcode;
      });

    
      // Remove information about tracked barcodes that are no longer tracked.
      session.removedTrackedBarcodes.forEach(identifier => {
        isViewShowingAlternateContent[identifier] = null;
        viewContents[identifier] = null;
      });

     // Update AR views
      Object.values(session.trackedBarcodes).forEach(trackedBarcode =>
        view.viewQuadrilateralForFrameQuadrilateral(trackedBarcode.location)
          .then(location => {

            updateView(trackedBarcode, location, isViewShowingAlternateContent[trackedBarcode.identifier])
          })
      );

     session.addedTrackedBarcodes.forEach(trackedBarcode => {
        // The offset of our overlay will be calculated from the top center anchoring point.
        window.advancedOverlay.setAnchorForTrackedBarcode(Scandit.Anchor.TopCenter, trackedBarcode).catch(console.warn);
        // We set the offset's height to be equal of the 100 percent of our overlay.
        // The minus sign means that the overlay will be above the barcode.
        window.advancedOverlay.setOffsetForTrackedBarcode(
          new Scandit.PointWithUnit(
            new Scandit.NumberWithUnit(0, Scandit.MeasureUnit.Fraction),
            new Scandit.NumberWithUnit(-1, Scandit.MeasureUnit.Fraction)
          ), trackedBarcode).catch(console.warn);
      });
    }
  });

  // To visualize the on-going barcode tracking process on screen, setup a data capture view that renders the
  // camera preview. The view must be connected to the data capture context.
  view = Scandit.DataCaptureView.forContext(context);

  // Connect the data capture view to the HTML element, so it can fill up its size and follow its position.
  view.connectToElement(document.getElementById('data-capture-view'));

  // Add a barcode tracking overlay to the data capture view to render the location of captured barcodes on top of
  // the video preview. This is optional, but recommended for better visual feedback.
  const overlay = Scandit.BarcodeTrackingBasicOverlay
    .withBarcodeTrackingForViewWithStyle(barcodeTracking, view, Scandit.BarcodeTrackingBasicOverlayStyle.Dot);

 // Add an advanced barcode tracking overlay to the data capture view to render AR visualization on top of
  // the camera preview.
  window.advancedOverlay = Scandit.BarcodeTrackingAdvancedOverlay.withBarcodeTrackingForView(barcodeTracking, view);
  /*window.advancedOverlay.listener = {
    didTapViewForTrackedBarcode: (overlay, trackedBarcode) => {
      view.viewQuadrilateralForFrameQuadrilateral(trackedBarcode.location)
        .then(location => updateView(trackedBarcode, location, !isViewShowingAlternateContent[trackedBarcode.identifier]));
    },
  }*/
  

  // Switch camera on to start streaming frames and enable the barcode tracking mode.
  // The camera is started asynchronously and will take some time to completely turn on.
  camera.switchToDesiredState(Scandit.FrameSourceState.On);
  barcodeTracking.isEnabled = true;
}, false);

function updateResults() {
  const list = document.getElementById('list');
  list.innerHTML = Object.values(window.results)
    .map(trackedBarcode => {
      const dataHTML = `<p class="barcodeData">${trackedBarcode.barcode.data}</p>`
      const symbology = new Scandit.SymbologyDescription(trackedBarcode.barcode.symbology);
      const symbologyHTML = `<p class="symbology">${symbology.readableName}</p>`
      return `<div class="result">${dataHTML}${symbologyHTML}</div>`;
    })
    .join('');
};

function resetResults() {
  window.results = {};
  document.getElementById('scanning').hidden = false;
  document.getElementById('results').hidden = true;
}

function done() {
  updateResults();
  document.getElementById('scanning').hidden = true;
  document.getElementById('results').hidden = false;
};

function scanAgain() {
  resetResults();
};

const updateView = (trackedBarcode, viewLocation, isShowingAlternateContent = false) => {

  isViewShowingAlternateContent[trackedBarcode.identifier] = isShowingAlternateContent;

  // If the barcode is wider than the desired percent of the data capture view's width, show it to the user.
  const shouldBeShown = viewLocation.width() > (screen.width * 0.1);



  var viewContent = null;
  if (shouldBeShown) {
    // Get the information you want to show from your back end system/database.
    viewContent = isShowingAlternateContent
      ? { title: trackedBarcode.barcode.data }
      : { title: "Report stock count", text: "Shelf: 4 Back Room: 8" };
  }


  // The AR view associated with the tracked barcode should only be set again if it was changed,
  // to avoid unnecessarily recreating it.
  const didViewChange = JSON.stringify(viewContents[trackedBarcode.identifier]) != JSON.stringify(viewContent);
  if (didViewChange) {
    viewContents[trackedBarcode.identifier] = viewContent;
    setView(trackedBarcode);
  }
}

const setView = (trackedBarcode) => {
  const viewContent = viewContents[trackedBarcode.identifier];
  const shouldShowARView = viewContent !== null;

  if (shouldShowARView) {
    const bubble = Scandit.TrackedBarcodeView.withHTMLElement(
      createBubbleWithContent(viewContent),
      // To get the best possible AR view quality, it is suggested to set AR view sizes with taking into account
      // the device pixel ratio and scale them down based on it.
      { scale: 1 / window.devicePixelRatio },
    );
    window.advancedOverlay.setViewForTrackedBarcode(bubble, trackedBarcode).catch(console.warn);
  } else {
    window.advancedOverlay.setViewForTrackedBarcode(null, trackedBarcode).catch(console.warn);
  }
}


const createBubbleWithContent = (content) => {
  const bubbleWidth = 234;
  const bubbleHeight = 60;

  const container = document.createElement("div");
  container.style.width = `${bubbleWidth * window.devicePixelRatio}px`;
  container.style.height = `${bubbleHeight * window.devicePixelRatio}px`;
  container.style.borderRadius = `${(bubbleHeight / 2) * window.devicePixelRatio}px`;
  container.style.backgroundColor = "#fffc"
  container.style.display = "flex";
  container.style.fontFamily = "Helvetica Neue";
  container.style.fontSize = `${14 * window.devicePixelRatio}px`;

  const icon = document.createElement("div");
  icon.style.width = `${bubbleHeight * window.devicePixelRatio}px`;
  icon.style.height = `${bubbleHeight * window.devicePixelRatio}px`;
  icon.style.borderRadius = `${(bubbleHeight / 2) * window.devicePixelRatio}px`;
  icon.style.backgroundColor = "#5AD5C8CC";
  container.appendChild(icon);

  const textContainer = document.createElement("div");
  textContainer.style.width = `${(bubbleWidth - bubbleHeight) * window.devicePixelRatio}px`;
  textContainer.style.height = `${bubbleHeight * window.devicePixelRatio}px`;
  textContainer.style.display = "flex";
  textContainer.style.flexDirection = "column";
  textContainer.style.justifyContent = "center";
  textContainer.style.alignItems = "flex-start";
  textContainer.style.paddingLeft = `${7 * window.devicePixelRatio}px`;
  container.appendChild(textContainer);

  if (content.title) {
    const title = document.createElement("p");
    title.style.margin = "0";
    title.style.fontWeight = "bold";
    title.innerText = content.title;
    textContainer.appendChild(title);
  }

  if (content.text) {
    const text = document.createElement("p");
    text.style.margin = "0";
    text.innerText = content.text;
    textContainer.appendChild(text);
  }

  return container;
};
