import { useEffect, useState, useRef, useCallback } from "react";
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonModal, useIonToast, IonFooter } from "@ionic/react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";

import { ClassRoom, listMyClasses, scanAttendance, listScanTypes, ScanType } from "../utils/api";
import "./Tab2.css";

const SCANNER_ID = "reader";

const SUPPORTED_FORMATS: Html5QrcodeSupportedFormats[] = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.ITF,
];

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [presentToast] = useIonToast();

  const showToast = (message: string, color: "success" | "danger" | "warning" | "primary" = "primary", duration: number = 2000) => {
    presentToast({ message, duration, color });
  };

  const stopScan = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
        console.log("Scanner stopped and cleared.");
      } catch (e) {
        console.warn("Error stopping scanner:", e);
      }
      html5QrCodeRef.current = null;
    }
    setShowScanner(false);
  }, []);

  const handleScanResult = useCallback(
    async (decodedText: string) => {
      stopScan();

      try {
        const { student } = await scanAttendance(selectedClassId, decodedText, selectedTypeId as any);
        showToast(student ? `Marked ${student.name} as present` : `Recorded scan: ${decodedText}`, "success", 1500);
      } catch (e: any) {
        showToast(e.message ?? "Failed to record attendance", "danger", 2500);
      }
    },
    [selectedClassId, selectedTypeId, stopScan]
  );

  const startScan = async () => {
    if (!selectedClassId || !selectedTypeId) {
      showToast("Select class and scan type first", "warning", 1500);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera access not supported by your browser.", "danger", 3000);
      return;
    }

    setShowScanner(true);

    setTimeout(async () => {
      try {
        const html5QrCode = new Html5Qrcode(SCANNER_ID, {
          formatsToSupport: [Html5QrcodeSupportedFormats.CODE_39],
        } as any);

        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 30,

            qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
              const width = Math.min(viewfinderWidth * 0.9, 400);
              const height = Math.min(viewfinderHeight * 0.25, 150);
              return { width, height };
            },

            aspectRatio: 1.7,
          },
          (decodedText, result) => {
            console.log("Decoded:", decodedText, result);
            handleScanResult(decodedText);
          },
          (errorMessage) => {}
        );

        console.log(" Scanner started (QR + Barcode)");
      } catch (e: any) {
        console.error("Start scan failed:", e);
        showToast("Camera start failed. Check permissions.", "danger", 2000);
        stopScan();
      }
    }, 1000);
  };

  // ✅ Fetch classes
  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch((e) => showToast(e.message ?? "Failed to load classes", "danger"));
  }, []);

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
        if (!types.length) showToast("No scan types configured for this class.", "warning");
      })
      .catch((e) => showToast(e.message, "danger"));
  }, [selectedClassId]);

  const isScanReady = selectedClassId && selectedTypeId;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Scan Attendance</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={startScan} disabled={!isScanReady}>
              Start Scan
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent fullscreen>
        <IonList inset={true}>
          <IonItem lines="full">
            <IonLabel position="stacked">Class</IonLabel>
            <IonSelect value={selectedClassId} placeholder="Select class" onIonChange={(e) => setSelectedClassId(e.detail.value)}>
              {classes.map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem lines="full">
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
        </IonList>

        <IonModal isOpen={showScanner} onDidDismiss={stopScan} className="full-screen-modal">
          <div className="scanner-container">
            <div id={SCANNER_ID} className="scanner-video" />
            <div className="scanner-overlay">
              <div className="scanner-frame" />
            </div>
          </div>

          <IonFooter>
            <IonToolbar>
              <IonButtons slot="end">
                <IonButton color="danger" onClick={stopScan}>
                  Close
                </IonButton>
              </IonButtons>
            </IonToolbar>
          </IonFooter>
        </IonModal>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
