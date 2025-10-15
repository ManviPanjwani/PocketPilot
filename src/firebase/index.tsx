import { Platform } from 'react-native';

const mod =
  Platform.OS === 'web'
    ? require('./firebase.web')
    : require('./firebase.native');

export const { firebaseAuth, db, storage } = mod;
export default mod;
