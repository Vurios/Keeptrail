// Mock react-native module for Node / Vitest testing environment
export const Platform = {
  OS: "android",
  select: (obj) => obj.android || obj.default,
};

export const Vibration = {
  vibrate: () => {},
  cancel: () => {},
};

export const StyleSheet = {
  create: (styles) => styles,
};

export const StatusBar = {
  currentHeight: 24,
};

export const View = "View";
export const Text = "Text";
export const TouchableOpacity = "TouchableOpacity";
export const ScrollView = "ScrollView";
export const SafeAreaView = "SafeAreaView";
export const Modal = "Modal";
export const TextInput = "TextInput";
export const FlatList = "FlatList";
export const Alert = {
  alert: () => {},
};
export const useColorScheme = () => "light";
