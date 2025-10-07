import { IonButton, IonContent, IonHeader, IonInput, IonItem, IonLabel, IonPage, IonTitle, IonToolbar, IonCard, IonCardContent, IonAlert, useIonAlert } from "@ionic/react";
import React, { useState } from "react";
import { supabase } from "../utils/SupabaseClient";

enum AuthView {
  SignIn,
  SignUp,
  PasswordReset,
}

const Auth: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<AuthView>(AuthView.SignIn);
  const [presentAlert] = useIonAlert(); // Use useIonAlert for proper Ionic alerts

  const isSigningUp = view === AuthView.SignUp;
  const isResettingPassword = view === AuthView.PasswordReset;

  // --- Utility Alert Function ---
  const showAlert = (message: string, isError: boolean = false) => {
    presentAlert({
      header: isError ? "Error" : "Success",
      message: message,
      buttons: ["OK"],
      cssClass: isError ? "alert-danger" : "alert-success",
    });
  };

  // --- Sign In Handler ---
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAlert(error.message, true);
    } else {
      // Success is handled by Supabase session listener, no need for an alert here
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
      showAlert(error.message, true);
    } else {
      showAlert("Sign-up successful! Please check your email to confirm your account.");
      setView(AuthView.SignIn); // Switch to sign-in view after success
    }
    setLoading(false);
  };

  // --- Password Reset Handler (NEW) ---
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showAlert("Please enter your email address to reset your password.", true);
      return;
    }
    setLoading(true);

    // NOTE: Supabase sends the reset link to the email provided.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`, // Adjust the redirect URL as necessary
    });

    if (error) {
      showAlert(error.message, true);
    } else {
      showAlert("Password reset link sent! Check your email inbox (and spam folder) for instructions.");
      setView(AuthView.SignIn); // Return to sign-in screen
    }
    setLoading(false);
  };

  const submitHandler = isResettingPassword ? handlePasswordReset : isSigningUp ? handleSignUp : handleSignIn;

  const getTitle = () => {
    switch (view) {
      case AuthView.SignUp:
        return "Create Account";
      case AuthView.PasswordReset:
        return "Reset Password";
      case AuthView.SignIn:
      default:
        return "Sign In";
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{getTitle()}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonCard className="ion-padding">
          <IonCardContent>
            {/* Form to handle submission using the appropriate handler */}
            <form onSubmit={submitHandler}>
              {/* Email Input is required for all modes */}
              <IonItem lines="full">
                <IonLabel position="floating">Email</IonLabel>
                <IonInput type="email" value={email} onIonChange={(e) => setEmail(e.detail.value || "")} required inputmode="email" autocomplete="email" />
              </IonItem>

              {/* Password Input is only visible for Sign In and Sign Up */}
              {!isResettingPassword && (
                <IonItem lines="full">
                  <IonLabel position="floating">Password</IonLabel>
                  <IonInput
                    type="password"
                    value={password}
                    onIonChange={(e) => setPassword(e.detail.value || "")}
                    required
                    minlength={6}
                    autocomplete={isSigningUp ? "new-password" : "current-password"}
                  />
                </IonItem>
              )}

              {/* Primary Submit Button */}
              <IonButton expand="block" type="submit" className="ion-margin-top" disabled={loading}>
                {loading ? "Processing..." : getTitle()}
              </IonButton>

              {/* Reset Password Button (Only shown on Sign In view) */}
              {view === AuthView.SignIn && (
                <IonButton expand="block" fill="clear" onClick={() => setView(AuthView.PasswordReset)} className="ion-margin-top ion-text-capitalize" disabled={loading}>
                  Forgot Password?
                </IonButton>
              )}

              {/* Toggle to switch between Sign In/Sign Up */}
              <IonButton expand="block" fill="clear" onClick={() => setView(isSigningUp ? AuthView.SignIn : AuthView.SignUp)} className="ion-margin-top ion-text-capitalize" disabled={loading}>
                {isSigningUp ? "Already have an account? Sign In" : "Don't have an account? Create an Account"}
              </IonButton>

              {/* Back to Sign In button (Only shown on Reset view) */}
              {isResettingPassword && (
                <IonButton expand="block" fill="clear" color="medium" onClick={() => setView(AuthView.SignIn)} className="ion-margin-top ion-text-capitalize" disabled={loading}>
                  Back to Sign In
                </IonButton>
              )}
            </form>
          </IonCardContent>
        </IonCard>
      </IonContent>
    </IonPage>
  );
};

export default Auth;
