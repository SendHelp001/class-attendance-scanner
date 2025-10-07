import {
  IonButton,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonLabel,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonToast,
} from "@ionic/react";
import { useEffect, useState } from "react";
import { getMyProfile, updateMyProfile, type Profile } from "../utils/api";

const ProfilePage: React.FC = () => {
  const [present] = useIonToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  useEffect(() => {
    getMyProfile()
      .then((p) => {
        setProfile(p);
        setDisplayName(p?.display_name ?? "");
      })
      .catch((e) => present({ message: e.message, duration: 2000, color: "danger" }));
  }, []);

  const onSave = async () => {
    try {
      const p = await updateMyProfile({ display_name: displayName });
      setProfile(p);
      present({ message: "Saved", duration: 1200, color: "success" });
    } catch (e: any) {
      present({ message: e.message, duration: 2000, color: "danger" });
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Profile</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem>
          <IonLabel position="stacked">Email</IonLabel>
          <IonInput value={profile?.email ?? ""} readonly />
        </IonItem>
        <IonItem>
          <IonLabel position="stacked">Name</IonLabel>
          <IonInput value={displayName} onIonInput={(e) => setDisplayName(e.detail.value ?? "")} />
        </IonItem>
        <IonButton expand="block" className="ion-margin-top" onClick={onSave}>
          Save
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default ProfilePage;
