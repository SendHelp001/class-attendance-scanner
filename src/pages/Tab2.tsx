import { useEffect, useState, useRef, useCallback } from "react";
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonModal, useIonToast, IonFooter } from "@ionic/react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
// Assuming you have these types/functions defined elsewhere
import { ClassRoom, listMyClasses, scanAttendance, listScanTypes, type ScanType } from "../utils/api";
import "./Tab2.css";

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [cameras, setCameras] = useState<any[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [presentToast] = useIonToast();
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const scannerId = "reader";

  const showToast = (message: string, color: "success" | "danger" | "warning" | "primary" = "primary", duration: number = 2000) => {
    presentToast({ message, duration, color });
  };

  // --- Stop scanning function (memoized) ---
  const stopScan = useCallback(async () => {
    try {
      await html5QrCodeRef.current?.stop();
      await html5QrCodeRef.current?.clear();
    } catch (e) {
      console.warn("Scanner already stopped or failed to clear.");
    }
    html5QrCodeRef.current = null;
    setShowScanner(false);
  }, []);

  // --- Handle scan result function (memoized) ---
  const handleScanResult = useCallback(
    async (decodedText: string) => {
      try {
        const { student } = await scanAttendance(selectedClassId, decodedText, selectedTypeId as any);
        showToast(student ? `Marked ${student.name}` : `Recorded scan: ${decodedText}`, "success", 1500);
        stopScan(); // Stop scanner after successful scan
      } catch (e: any) {
        showToast(e.message ?? "Failed to record attendance", "danger", 2000);
      }
    },
    [selectedClassId, selectedTypeId, stopScan]
  );

  // --- Load classes and cameras (runs once) ---
  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch((e) => showToast(e.message, "danger"));

    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices);
        if (devices.length > 0) setSelectedCameraId(devices[0].id);
      })
      .catch(() => showToast("Unable to access camera devices", "danger"));
  }, []);

  // --- Load scan types (runs when selectedClassId changes) ---
  useEffect(() => {
    if (!selectedClassId) {
      setScanTypes([]);
      setSelectedTypeId("");
      return;
    }
    listScanTypes(selectedClassId)
      .then((types) => {
        setScanTypes(types);
        if (types.length && !selectedTypeId) setSelectedTypeId(types[0].id);
      })
      .catch((e) => showToast(e.message, "danger"));
  }, [selectedClassId]);

  // --- Start scanning ---
  const startScan = async () => {
    if (!selectedClassId || !selectedTypeId) {
      showToast("Select class and scan type first", "warning", 1500);
      return;
    }
    if (!selectedCameraId) {
      showToast("No camera available or selected", "danger", 2000);
      return;
    }

    setShowScanner(true);

    // Use a small timeout to ensure the IonModal has rendered the scannerId div
    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(scannerId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { deviceId: { exact: selectedCameraId } },
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
              const qrboxSize = Math.floor(minEdgeSize * 0.7); // 70% of the smaller dimension
              return { width: qrboxSize, height: qrboxSize };
            },
            aspectRatio: 1.0,
          },
          (decodedText) => handleScanResult(decodedText),
          () => {
            /* Ignore decode errors */
          }
        );

        console.log("Scanner started.");
      } catch (e: any) {
        showToast(e.message ?? "Camera start failed", "danger", 2000);
        stopScan();
      }
    }, 300);
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Scan Attendance</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={startScan} disabled={!selectedClassId || !selectedTypeId}>
              Start Scan
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonList inset={true}>
          {/* Class Selection */}
          <IonItem>
            <IonLabel position="stacked">Class</IonLabel>
            <IonSelect value={selectedClassId} placeholder="Select class" onIonChange={(e) => setSelectedClassId(e.detail.value)}>
              {classes.map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          {/* Scan Type Selection */}
          <IonItem>
            <IonLabel position="stacked">Scan Type</IonLabel>
            <IonSelect
              value={selectedTypeId}
              placeholder={scanTypes.length ? "Select type" : "No types configured"}
              onIonChange={(e) => setSelectedTypeId(e.detail.value)}
              disabled={!scanTypes.length}
            >
              {scanTypes.map((t) => (
                <IonSelectOption key={t.id} value={t.id}>
                  {t.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          {/* Camera Selection (Only if more than one camera is available) */}
          {cameras.length > 1 && (
            <IonItem>
              <IonLabel position="stacked">Camera</IonLabel>
              <IonSelect value={selectedCameraId} onIonChange={(e) => setSelectedCameraId(e.detail.value)}>
                {cameras.map((d) => (
                  <IonSelectOption key={d.id} value={d.id}>
                    {d.label || `Camera ${d.id.slice(0, 6)}...`}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}
        </IonList>

        <IonModal
          isOpen={showScanner}
          onDidDismiss={stopScan}
          // Optional: Force full screen on mobile
          className="full-screen-modal"
        >
          <div className="scanner-container">
            {/* The video stream is injected into this div by html5-qrcode */}
            <div id={scannerId} className="scanner-video" />
            <div className="scanner-overlay">
              <div className="scanner-frame" />
            </div>
          </div>
          <IonFooter>
            <IonToolbar>
              <IonButtons slot="end">
                <IonButton onClick={stopScan}>Close</IonButton>
              </IonButtons>
            </IonToolbar>
          </IonFooter>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
