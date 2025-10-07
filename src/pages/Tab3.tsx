import { useEffect, useState } from "react";
import {
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  useIonToast,
} from "@ionic/react";
import "./Tab3.css";
import { ClassLog, ClassRoom, listLogs, listMyClasses } from "../utils/api";

const Tab3: React.FC = () => {
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [logs, setLogs] = useState<ClassLog[]>([]);
  const [present] = useIonToast();

  useEffect(() => {
    listMyClasses()
      .then(setClasses)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    listLogs(selectedClassId)
      .then(setLogs)
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, [selectedClassId]);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Logs</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
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

        <IonList>
          {logs.map((log) => (
            <IonItem key={log.id} lines="full">
              <IonLabel>
                <h2>{log.action}</h2>
                <p>{new Date(log.created_at).toLocaleString()}</p>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Tab3;
