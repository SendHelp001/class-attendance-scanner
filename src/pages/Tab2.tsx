import { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonRadio,
  IonRadioGroup,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from "@ionic/react";
import "./Tab2.css";
import { AttendanceScanType, ClassRoom, listMyClasses, scanAttendance } from "../utils/api";
import { BarcodeScanner } from "@capacitor-mlkit/barcode-scanning";
import { BrowserMultiFormatReader } from "@zxing/browser";

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [type, setType] = useState<AttendanceScanType>("IN");
  const [present] = useIonToast();
  const [customNote, setCustomNote] = useState<string>("");
  const [scannerMode, setScannerMode] = useState<"native" | "web">("native");

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, []);

  const ensurePermission = async () => {
    const { camera } = await BarcodeScanner.checkPermissions();
    if (camera === "granted") return true;
    const req = await BarcodeScanner.requestPermissions();
    return req.camera === "granted";
  };

  const onScan = async () => {
    if (!selectedClassId) {
      present({ message: "Select a class", duration: 1500 });
      return;
    }
    try {
      let value = "";
      if (scannerMode === "native") {
        const ok = await ensurePermission();
        if (!ok) {
          present({ message: "Camera permission denied", duration: 2000, color: "danger" });
          return;
        }
        const { barcodes } = await BarcodeScanner.scan();
        if (!barcodes?.length) return;
        value = barcodes[0].rawValue ?? "";
      } else {
        // Web fallback using ZXing
        const codeReader = new BrowserMultiFormatReader();
        const video = document.createElement("video");
        video.style.position = "fixed";
        video.style.inset = "0";
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";
        video.style.zIndex = "9999";
        document.body.appendChild(video);
        try {
          const result = await codeReader.decodeOnceFromVideoDevice(undefined, video);
          value = result?.getText() ?? "";
        } finally {
          try {
            (codeReader as any)?.reset?.();
          } catch {}
          video.remove();
        }
      }
      if (!value) return;
      const noteToSend = type === "CUSTOM" ? customNote?.trim() || "CUSTOM" : undefined;
      const { student } = await scanAttendance(selectedClassId, value, type, noteToSend);
      present({
        message: student ? `Marked ${student.name}` : `Recorded scan: ${value}`,
        duration: 1600,
        color: "success",
      });
    } catch (e: any) {
      present({ message: e.message ?? "Scan failed", duration: 2000, color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Scan</IonTitle>
          <IonButtons slot="end">
            <IonSelect
              value={scannerMode}
              interface="popover"
              onIonChange={(e) => setScannerMode(e.detail.value)}
            >
              <IonSelectOption value="native">Native</IonSelectOption>
              <IonSelectOption value="web">Web</IonSelectOption>
            </IonSelect>
            <IonButton onClick={onScan}>Scan</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonList>
          <IonItem>
            <IonLabel>Class</IonLabel>
            <IonSelect
              value={selectedClassId}
              placeholder="Select class"
              onIonChange={(e) => setSelectedClassId(e.detail.value)}
            >
              {classes.map((c) => (
                <IonSelectOption key={c.id} value={c.id}>
                  {c.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonItem>

          <IonRadioGroup value={type} onIonChange={(e) => setType(e.detail.value)}>
            <IonItem>
              <IonLabel>IN</IonLabel>
              <IonRadio value="IN" />
            </IonItem>
            <IonItem>
              <IonLabel>OUT</IonLabel>
              <IonRadio value="OUT" />
            </IonItem>
            <IonItem>
              <IonLabel>CUSTOM</IonLabel>
              <IonRadio value="CUSTOM" />
            </IonItem>
          </IonRadioGroup>

          {type === "CUSTOM" && (
            <IonItem>
              <IonLabel position="floating">Custom description</IonLabel>
              <IonInput
                value={customNote}
                onIonChange={(e: any) => setCustomNote(e.detail.value ?? "")}
              />
            </IonItem>
          )}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
