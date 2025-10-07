import { useEffect, useState } from "react";
import { IonButton, IonButtons, IonContent, IonHeader, IonItem, IonLabel, IonList, IonPage, IonSelect, IonSelectOption, IonTitle, IonToolbar, useIonToast } from "@ionic/react";
import "./Tab2.css";
import { ClassRoom, listMyClasses, scanAttendance, listScanTypes, type ScanType } from "../utils/api";
import { BrowserMultiFormatReader } from "@zxing/browser";

const Tab2: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [present] = useIonToast();
  const [scanTypes, setScanTypes] = useState<ScanType[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState<string>("");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId]);

  const onScan = async () => {
    if (!selectedClassId) {
      present({ message: "Select a class", duration: 1500 });
      return;
    }
    if (!selectedTypeId) {
      present({ message: "Select a scan type", duration: 1500 });
      return;
    }

    // --- Start Web Scanning Logic (Single Scan) ---
    const codeReader = new BrowserMultiFormatReader();
    const video = document.createElement("video");

    // Configure video element for full-screen view
    video.style.position = "fixed";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.zIndex = "9999";
    document.body.appendChild(video);

    let value = "";

    try {
      const result = await codeReader.decodeOnceFromVideoDevice(undefined, video);
      value = result?.getText() ?? "";

      if (!value) return;

      // Process the scan result
      const { student } = await scanAttendance(selectedClassId, value, selectedTypeId as any);

      present({
        message: student ? `Marked ${student.name}` : `Recorded scan: ${value}`,
        duration: 1600,
        color: "success",
      });
    } catch (e: any) {
      present({ message: e.message ?? "Scan failed", duration: 2000, color: "danger" });
    } finally {
      try {
        const stream = (video as any).srcObject as MediaStream;
        if (stream) {
          stream.getTracks().forEach((track) => track.stop());
        }
      } catch {}
      video.remove();
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Scan</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onScan}>Start Scan</IonButton>
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
            <IonLabel position="stacked">Scan type</IonLabel>
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
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;
