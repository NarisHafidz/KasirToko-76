import { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Dashboard: undefined;
  POS: { scannedBarcode?: string } | undefined;
  Products: { scannedBarcode?: string } | undefined;
  Reports: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  MainApp?: NavigatorScreenParams<MainTabParamList> | undefined;
  Scanner: {
    mode: 'pos' | 'product';
  };
};
