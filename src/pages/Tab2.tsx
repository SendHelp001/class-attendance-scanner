import { useEffect, useState } from "react";
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
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

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [type, setType] = useState<AttendanceScanType>("IN");
  const [present] = useIonToast();

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
    const ok = await ensurePermission();
    if (!ok) {
      present({ message: "Camera permission denied", duration: 2000, color: "danger" });
      return;
    }
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (!barcodes?.length) return;
      const value = barcodes[0].rawValue ?? "";
      if (!value) return;
      const { student } = await scanAttendance(selectedClassId, value, type);
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
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
