import { Redirect } from "expo-router";

export default function Index() {
  // Guests can browse (with limits); no forced login.
  return <Redirect href="/(tabs)" />;
}
