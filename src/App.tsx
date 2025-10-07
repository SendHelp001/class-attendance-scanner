import { Redirect, Route } from "react-router-dom";
import { IonApp, IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, setupIonicReact } from "@ionic/react";
import { IonReactRouter } from "@ionic/react-router";
import { barcodeOutline, bookOutline, listOutline } from "ionicons/icons";
import Tab1 from "./pages/Tab1";
import Tab2 from "./pages/Tab2";
import ProfilePage from "./pages/Profile";
import Auth from "./pages/Auth";
import { useAuth } from "./utils/AuthProvider";
import ClassPage from "./pages/ClassPage";

/* Core CSS required for Ionic components to work properly */
import "@ionic/react/css/core.css";

/* Basic CSS for apps built with Ionic */
import "@ionic/react/css/normalize.css";
import "@ionic/react/css/structure.css";
import "@ionic/react/css/typography.css";

/* Optional CSS utils that can be commented out */
import "@ionic/react/css/padding.css";
import "@ionic/react/css/float-elements.css";
import "@ionic/react/css/text-alignment.css";
import "@ionic/react/css/text-transformation.css";
import "@ionic/react/css/flex-utils.css";
import "@ionic/react/css/display.css";

/* import '@ionic/react/css/palettes/dark.always.css'; */
/* import '@ionic/react/css/palettes/dark.class.css'; */
import "@ionic/react/css/palettes/dark.system.css";

/* Theme variables */
import "./theme/variables.css";

setupIonicReact();
const BASE_PATH = "/devcon-scanner";

const App: React.FC = () => {
  const { session, loading } = useAuth();
  if (loading) return null;
  const isAuthed = !!session;

  return (
    <IonApp>
      <IonReactRouter>
        {isAuthed ? (
          <IonTabs>
            <IonRouterOutlet>
              <Route exact path={`${BASE_PATH}/tab1`}>
                <Tab1 />
              </Route>
              <Route exact path={`${BASE_PATH}/tab2`}>
                <Tab2 />
              </Route>
              <Route path={`${BASE_PATH}/profile`}>
                <ProfilePage />
              </Route>
              <Route path={`${BASE_PATH}/class`}>
                <ClassPage />
              </Route>

              <Route exact path="/">
                <Redirect to={`${BASE_PATH}/tab1`} />
              </Route>
            </IonRouterOutlet>

            <IonTabBar slot="bottom">
              <IonTabButton tab="tab1" href={`${BASE_PATH}/tab1`}>
                <IonIcon aria-hidden="true" icon={bookOutline} />
                <IonLabel>Classes</IonLabel>
              </IonTabButton>
              <IonTabButton tab="tab2" href={`${BASE_PATH}/tab2`}>
                <IonIcon aria-hidden="true" icon={barcodeOutline} />
                <IonLabel>Scan</IonLabel>
              </IonTabButton>
              <IonTabButton tab="profile" href={`${BASE_PATH}/profile`}>
                <IonIcon aria-hidden="true" icon={listOutline} />
                <IonLabel>Profile</IonLabel>
              </IonTabButton>
            </IonTabBar>
          </IonTabs>
        ) : (
          <IonRouterOutlet>
            <Route exact path={`${BASE_PATH}/auth`}>
              <Auth />
            </Route>
            <Route>
              <Redirect to={`${BASE_PATH}/auth`} />
            </Route>
          </IonRouterOutlet>
        )}
      </IonReactRouter>
    </IonApp>
  );
};

export default App;
