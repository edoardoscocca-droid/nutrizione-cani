import { Stack } from 'expo-router';
import DogForm from '../../lib/DogForm';

export default function NewDog() {
  return (
    <>
      <Stack.Screen options={{ title: 'Nuovo cane' }} />
      <DogForm />
    </>
  );
}
