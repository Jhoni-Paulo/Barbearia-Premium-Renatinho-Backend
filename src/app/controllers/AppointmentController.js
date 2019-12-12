import * as Yup from 'yup'
import { parseISO, isBefore, getMinutes, format, subHours } from 'date-fns'
import pt from 'date-fns/locale/pt'
import User from '../models/User'
import File from '../models/File'
import Appointment from '../models/Appointment'
import Notification from '../schemas/Notification'

import Mail from '../../lib/Mail'

class AppointmentController{

  async index(req, res){
    const { page = 1 } = req.query

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date', 'past', 'cancelable'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['path', 'url']
            },
          ],
        },
      ],
    })
    return res.json(appointments)
  }

  async store(req, res){
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required()
    })

    if(!(await schema.isValid(req.body))){
      return res.status(400).json( {
        error: "erro de validação",
        validações:  await schema.validate(req.body).catch((err) => err.errors)
      })
    }

    const { provider_id, date } = req.body

    const checkIsProvider = await User.findOne({
      where: { id: provider_id, provider: true}
    })

    if (!checkIsProvider)
      return res.status(401).json({ error: 'você só pode criar compromissos com prestadores de serviço'})

    if(req.userId == provider_id)
      return res.status(401).json({ error: 'Prestadores de serviço não podem criar compromissos para si mesmos'})

    const scheduleHour = parseISO(date)

    const minute = getMinutes(scheduleHour)

    if(!(minute == 30 || minute == 0)){
      return res
        .status(400)
        .json({ error: `Somente são permitidos horários com intervalo de 30min a partir da hora inicial` })
    }

    if(isBefore(scheduleHour, new Date()))
      return res.status(400).json({ error: 'Datas passadas não são permitidas' })

    const checkAvailability = await Appointment.findOne({
      where: { provider_id, canceled_at: null, date: scheduleHour }
    })

    if(checkAvailability)
      return res.status(400).json({ error: 'Horário indisponível' })

    const appointment = await Appointment.create({
      user_id: req.userId, provider_id, date
    })

    const user = await User.findByPk(req.userId)
    const formattedDate = format(
      scheduleHour,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    )

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formattedDate}`,
      user: provider_id
    })

    return res.json(appointment)
  }

  async delete(req, res){
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email']
        },
        {
          model: User,
          as: 'user',
          attributes: ['name']
        }
      ]
    })

    if(appointment.user_id != req.userId)
      return res.status(401).json({ error: 'Você não tem permissão para cancelar esse agendamento'})

    const dateWithSub = subHours(appointment.date, 2)

    if(isBefore(dateWithSub, new Date()))
      return res
      .status(401)
      .json({ error: 'Cancelamento de agendamentos só podem ser feitos com no mínimo 2h de antecedencia'})

    appointment.canceled_at = new Date();

    await appointment.save()

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}>`,
      subject: 'Agendamento cancelado',
      template: 'partials/cancellation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(
          appointment.date,
          "'dia' dd 'de' MMMM', às' H:mm'h'",
          { locale: pt }
        )
      }
    })

    return res.json(appointment)
  }
}

export default new AppointmentController()
