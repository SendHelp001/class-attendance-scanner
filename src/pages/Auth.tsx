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
} from "@ionic/react";
import React, { useState } from "react";
import { supabase } from "../utils/SupabaseClient";

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  // State to switch between Sign In and Sign Up views
  const [isSigningUp, setIsSigningUp] = useState(false);

  // --- Sign In Handler ---
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      // Success: Supabase client should handle the session update.
      alert("Signed in successfully!");
    }

    setLoading(false);
  };

  // --- Sign Up Handler ---
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      // Success: User receives an email to confirm their account
      alert("Sign-up successful! Please check your email to confirm your account.");
      // Optionally switch back to the sign-in view
      setIsSigningUp(false);
    }
    setLoading(false);
  };

  const submitHandler = isSigningUp ? handleSignUp : handleSignIn;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{isSigningUp ? "Create Account" : "Sign In"}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {/* Form to handle submission using the appropriate handler */}
        <form onSubmit={submitHandler}>
          <IonItem lines="full">
            <IonLabel position="floating">Email</IonLabel>
            <IonInput
              type="email"
              value={email}
              onIonChange={(e) => setEmail(e.detail.value!)}
              required
              inputmode="email"
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="floating">Password</IonLabel>
            <IonInput
              type="password"
              value={password}
              onIonChange={(e) => setPassword(e.detail.value!)}
              required
              minlength={6} // Recommended for security
            />
          </IonItem>

          <IonButton expand="block" type="submit" className="ion-margin-top" disabled={loading}>
            {loading ? "Loading..." : isSigningUp ? "Sign Up" : "Sign In"}
          </IonButton>

          {/* Toggle button to switch between modes */}
          <IonButton
            expand="block"
            fill="clear"
            onClick={() => setIsSigningUp(!isSigningUp)}
            className="ion-margin-top"
          >
            {isSigningUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </IonButton>
        </form>
      </IonContent>
    </IonPage>
  );
};

export default Auth;
