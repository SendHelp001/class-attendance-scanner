import { useEffect, useState, useRef } from "react";
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, IonModal, useIonToast, IonFooter } from "@ionic/react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Result } from "@zxing/library";
import { ClassRoom, listMyClasses, scanAttendance, listScanTypes, type ScanType } from "../utils/api";
import "./Tab2.css";

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");
  const [showScanner, setShowScanner] = useState(false);
  const [videoInputDevices, setVideoInputDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [present] = useIonToast();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const codeReader = useRef(new BrowserMultiFormatReader());

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
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
      })
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, [selectedClassId]);

  // --- Fetch available cameras ---
  useEffect(() => {
    BrowserMultiFormatReader.listVideoInputDevices()
      .then((devices) => {
        setVideoInputDevices(devices);
        if (devices.length > 0) setSelectedDeviceId(devices[0].deviceId);
      })
      .catch(() =>
        present({
          message: "Unable to access camera devices",
          duration: 2000,
          color: "danger",
        })
      );
  }, []);

  // --- Start scanning ---
  const startScan = async () => {
    if (!selectedClassId || !selectedTypeId) {
      present({ message: "Select class and scan type first", duration: 1500 });
      return;
    }
    setShowScanner(true);

    setTimeout(async () => {
      if (videoRef.current) {
        try {
          controlsRef.current = await codeReader.current.decodeFromVideoDevice(selectedDeviceId || undefined, videoRef.current, async (result: Result | undefined, err) => {
            if (result) {
              const text = result.getText();
              await handleScanResult(text);
            }
          });
        } catch (e: any) {
          present({
            message: e.message ?? "Camera access failed",
            duration: 2000,
            color: "danger",
          });
          stopScan();
        }
      }
    }, 300);
  };

  // --- Stop scanning & cleanup ---
  const stopScan = () => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    setShowScanner(false);
  };

  // --- Handle Scan Result ---
  const handleScanResult = async (value: string) => {
    try {
      const { student } = await scanAttendance(selectedClassId, value, selectedTypeId as any);

      present({
        message: student ? `Marked ${student.name}` : `Recorded scan: ${value}`,
        duration: 1500,
        color: "success",
      });
      stopScan(); // Stop after successful scan (or make it continuous if desired)
    } catch (e: any) {
      present({
        message: e.message ?? "Failed to record attendance",
        duration: 2000,
        color: "danger",
      });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Scan Attendance</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={startScan}>Start Scan</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList>
          <IonItem>
            <IonLabel>Class</IonLabel>
            <IonSelect value={selectedClassId} placeholder="Select class" onIonChange={(e) => setSelectedClassId(e.detail.value)}>
              {classes.map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonItem>
            <IonLabel>Scan Type</IonLabel>
            <IonSelect
              value={selectedTypeId}
              placeholder={scanTypes.length ? "Select type" : "No types configured (add in Class > Scan Types)"}
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

          {videoInputDevices.length > 1 && (
            <IonItem>
              <IonLabel>Camera</IonLabel>
              <IonSelect value={selectedDeviceId} onIonChange={(e) => setSelectedDeviceId(e.detail.value)}>
                {videoInputDevices.map((d) => (
                  <IonSelectOption key={d.deviceId} value={d.deviceId}>
                    {d.label || `Camera ${d.deviceId.slice(0, 6)}...`}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}
        </IonList>

        <IonModal isOpen={showScanner} onDidDismiss={stopScan}>
          <div className="scanner-container">
            <video ref={videoRef} autoPlay muted playsInline className="scanner-video"></video>
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
