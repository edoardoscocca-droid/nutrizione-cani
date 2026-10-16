import { Stack, useLocalSearchParams } from 'expo-router';
import DogForm from '../../../lib/DogForm';

export default function EditDog() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={{ title: 'Modifica profilo' }} />
      <DogForm id={id} />
    </>
  );
}
