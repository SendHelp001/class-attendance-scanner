import { useEffect, useState } from "react";
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast,
  IonRefresher, // <-- NEW IMPORT
  IonRefresherContent, // <-- NEW IMPORT
} from "@ionic/react";
import "./Tab1.css";
import { ClassRoom, Student, addStudent, listMyClasses, listStudents, createClass, joinClassByCode } from "../utils/api";
import { supabase } from "../utils/SupabaseClient";
import { useHistory } from "react-router-dom";

const Tab1: React.FC = () => {
  const history = useHistory();
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [newClassName, setNewClassName] = useState<string>("");
  const [present] = useIonToast();
  const [activeClassId, setActiveClassId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState<string>("");
  const [studentName, setStudentName] = useState<string>("");
  const [joinCode, setJoinCode] = useState<string>("");

  const load = async () => {
    try {
      const res = await listMyClasses();
      setClasses(res);
    } catch (e: any) {
      present({ message: e.message ?? "Failed to load classes", duration: 2000, color: "danger" });
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await load();
    event.detail.complete();
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!activeClassId) {
      setStudents([]);
      return;
    }
    listStudents(activeClassId)
      .then(setStudents)
      .catch((e) =>
        present({
          message: e.message ?? "Failed to load students",
          duration: 2000,
          color: "danger",
        })
      );
  }, [activeClassId]);

  const onCreate = async () => {
    if (!newClassName.trim()) return;
    try {
      const created = await createClass(newClassName.trim());
      setNewClassName("");
      present({ message: "Class created", duration: 1400, color: "success" });
      setClasses([created, ...classes]);
    } catch (e: any) {
      present({ message: e.message ?? "Failed to create class", duration: 2000, color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Classes</IonTitle>
          <div slot="end">
            <IonButton fill="clear" onClick={() => supabase.auth.signOut()}>
              Logout
            </IonButton>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Create a new class</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonInput placeholder="Class name" value={newClassName} onIonInput={(e) => setNewClassName(e.detail.value ?? "")} />
            </IonItem>
            <IonButton expand="block" onClick={onCreate}>
              Create
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonCard>
          <IonCardHeader>
            <IonCardTitle>Join a class by code</IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem>
              <IonInput placeholder="Enter code" value={joinCode} onIonInput={(e) => setJoinCode(e.detail.value ?? "")} />
            </IonItem>
            <IonButton
              expand="block"
              onClick={async () => {
                if (!joinCode.trim()) return;
                try {
                  const cls = await joinClassByCode(joinCode.trim());
                  present({ message: `Joined ${cls.name}`, duration: 1400, color: "success" });
                  setJoinCode("");
                  load(); // Reload classes list after joining
                } catch (e: any) {
                  present({
                    message: e.message ?? "Failed to join",
                    duration: 2000,
                    color: "danger",
                  });
                }
              }}
            >
              Join
            </IonButton>
          </IonCardContent>
        </IonCard>

        <IonList>
          {classes.map((c) => (
            <div key={c.id}>
              <IonItem button lines="full" onClick={() => setActiveClassId(activeClassId === c.id ? "" : c.id)}>
                <IonLabel>
                  <h2>{c.name}</h2>
                  <p>Share code: {c.code}</p>
                </IonLabel>
              </IonItem>
              {activeClassId === c.id && (
                <IonButton className="ion-margin" onClick={() => history.push(`/devcon-scanner/class?id=${c.id}`)}>
                  Open Class
                </IonButton>
              )}
              {activeClassId === c.id && (
                <IonCard>
                  <IonCardHeader>
                    <IonCardTitle>Students</IonCardTitle>
                  </IonCardHeader>
                  <IonCardContent>
                    <IonItem>
                      <IonInput placeholder="Student ID (barcode)" value={studentId} onIonInput={(e) => setStudentId(e.detail.value ?? "")} />
                    </IonItem>
                    <IonItem>
                      <IonInput placeholder="Student Name" value={studentName} onIonInput={(e) => setStudentName(e.detail.value ?? "")} />
                    </IonItem>
                    <IonButton
                      expand="block"
                      onClick={async () => {
                        if (!studentId.trim() || !studentName.trim()) return;
                        try {
                          await addStudent(c.id, studentId.trim(), studentName.trim());
                          setStudentId("");
                          setStudentName("");
                          const list = await listStudents(c.id);
                          setStudents(list);
                          present({ message: "Student added", duration: 1200, color: "success" });
                        } catch (e: any) {
                          present({
                            message: e.message ?? "Failed to add student",
                            duration: 2000,
                            color: "danger",
                          });
                        }
                      }}
                    >
                      Add Student
                    </IonButton>
                    <IonList>
                      {students.map((s) => (
                        <IonItem key={s.id} lines="full">
                          <IonLabel>
                            <h3>{s.name}</h3>
                            <p>ID: {s.student_id}</p>
                          </IonLabel>
                        </IonItem>
                      ))}
                    </IonList>
                  </IonCardContent>
                </IonCard>
              )}
            </div>
          ))}
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default Tab1;
